/**
 * ChessSession — one game in progress as an immutable value for the screen
 * (docs/CHESS_RULES.md §4–§7): whose side the player took, the difficulty,
 * the seed, and the game record. The React layer only dispatches into these
 * functions; the rules live in engine.ts / rules.ts / record.ts and the
 * opponent in cpu.ts.
 *
 * The record (`Game`, record.ts) is mutable for speed — a replay of
 * thousands of plies makes one move per ply. A session never mutates the
 * record it holds: every change copies it first (`cloneGame`, linear in the
 * number of plies and without generating a single move) and changes the copy,
 * so a session handed to React stays exactly what it was.
 *
 * The CPU's pause (`CPU_DELAY_MS`, 450 ms) is the screen's: the state layer
 * arms one timeout and calls `applyCpuMove` inside it (§5,
 * docs/GAME_LIFECYCLE.md「CPU 探索」). Nothing here waits or schedules.
 *
 * There is no clock on screen (§9); elapsed seconds are carried for the
 * statistics only.
 */
import { decideCpuMove, type CpuDecision } from './cpu';
import { clonePosition, inCheck } from './engine';
import { createGame, findMove, playMove, undoMove, type Game } from './record';
import { decodeMoveList, encodeMoveList } from './serialize';
import {
  BLACK,
  FLAG_CASTLE,
  FLAG_EN_PASSANT,
  WHITE,
  isCapture,
  moveFlags,
  moveFrom,
  movePromotion,
  moveTo,
  type Color,
  type Difficulty,
  type EndReason,
  type Move,
  type Outcome,
} from './types';

export interface ChessSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** The side the player took for this game (§1). White moves first. */
  readonly playerColor: Color;
  /** The record. Read-only from here on: sessions copy before they change it. */
  readonly game: Game;
  readonly elapsedSeconds: number;
}

/** From the player's side of the board (§3, §9). */
export type GameStatus = 'playing' | 'won' | 'lost' | 'draw';

/**
 * A token that makes one game's seed its own: the time in base 36 and a
 * random part, as the four CPU board games do. The seed pins the CPU down
 * completely (§5.4), which is what Undo rests on (§6).
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `chess-${token}`;

/**
 * A fresh game from the standard position (§1). With the player on Black the
 * session starts on the CPU's turn, which the screen plays out like any other.
 */
export function createSession(
  difficulty: Difficulty,
  playerColor: Color = WHITE,
  seed: string = matchSeed(newSeedToken()),
): ChessSession {
  return { seed, difficulty, playerColor, game: createGame(), elapsedSeconds: 0 };
}

/**
 * A copy of a record that shares nothing mutable with it. The history
 * entries and undo records are immutable values, so copying the arrays is
 * enough; the position is the one mutable piece and is cloned.
 */
export function cloneGame(game: Game): Game {
  return {
    position: clonePosition(game.position),
    moves: [...game.moves],
    undos: [...game.undos],
    history: [...game.history],
    legal: [...game.legal],
    outcome: game.outcome,
  };
}

/** The colour to move now. Meaningless once the game is over. */
export const sideToMove = (session: ChessSession): Color => session.game.position.side;

export const isOver = (session: ChessSession): boolean => session.game.outcome !== null;

export const isPlayerTurn = (session: ChessSession): boolean =>
  !isOver(session) && sideToMove(session) === session.playerColor;

export const isCpuTurn = (session: ChessSession): boolean =>
  !isOver(session) && sideToMove(session) !== session.playerColor;

/** The ending, or null while the game goes on (§3). */
export const outcomeOf = (session: ChessSession): Outcome | null => session.game.outcome;

/** Why the game ended, or null while it goes on (§3, §9). */
export const endReasonOf = (session: ChessSession): EndReason | null =>
  session.game.outcome?.reason ?? null;

/** Win / loss / draw from the player's side (§3). */
export function statusOf(session: ChessSession): GameStatus {
  const outcome = session.game.outcome;
  if (outcome === null) return 'playing';
  if (outcome.winner === null) return 'draw';
  return outcome.winner === session.playerColor ? 'won' : 'lost';
}

/** Whether the side to move stands in check now (the status line and the king's ring — §9). */
export const isInCheck = (session: ChessSession): boolean => inCheck(session.game.position);

/** The last move played, for the from/to marks (§9), or null at the start. */
export function lastMove(session: ChessSession): Move | null {
  const moves = session.game.moves;
  return moves.length === 0 ? null : moves[moves.length - 1]!;
}

/** One place a selected piece can go (§4). */
export interface Target {
  readonly to: number;
  /** A capture — en passant included — is marked by a different shape (§4). */
  readonly capture: boolean;
  /** The move promotes: the picker opens before it is played (§4). */
  readonly promotion: boolean;
  readonly castle: boolean;
  readonly enPassant: boolean;
}

/**
 * Where the player's piece on `from` may go, one entry per destination — a
 * promotion's four moves are one target (§4). Empty when it is not the
 * player's turn or the square holds nothing of theirs that can move.
 */
export function legalTargets(session: ChessSession, from: number): Target[] {
  if (!isPlayerTurn(session)) return [];
  const out: Target[] = [];
  for (const move of session.game.legal) {
    if (moveFrom(move) !== from) continue;
    const to = moveTo(move);
    if (out.some((target) => target.to === to)) continue;
    const flags = moveFlags(move);
    out.push({
      to,
      capture: isCapture(move),
      promotion: movePromotion(move) !== 0,
      castle: (flags & FLAG_CASTLE) !== 0,
      enPassant: (flags & FLAG_EN_PASSANT) !== 0,
    });
  }
  return out;
}

/**
 * The squares whose piece the player may select now: those with at least one
 * legal move (§4 — a pinned piece, or one that cannot answer a check, is not
 * selectable). Ascending.
 */
export function selectableSquares(session: ChessSession): number[] {
  if (!isPlayerTurn(session)) return [];
  const squares = new Set<number>();
  for (const move of session.game.legal) squares.add(moveFrom(move));
  return [...squares].sort((a, b) => a - b);
}

export interface MoveOutcome {
  readonly session: ChessSession;
  readonly move: Move;
}

/**
 * The player plays `from` → `to` (with `promotion`, a piece kind, when the
 * move promotes — §2.6). Null when it is not the player's turn or the move is
 * not legal, a promotion without its piece included.
 */
export function applyPlayerMove(
  session: ChessSession,
  from: number,
  to: number,
  promotion = 0,
): MoveOutcome | null {
  if (!isPlayerTurn(session)) return null;
  const move = findMove(session.game, from, to, promotion);
  if (move === null) return null;
  const game = cloneGame(session.game);
  playMove(game, move);
  return { session: { ...session, game }, move };
}

/**
 * The move the CPU decides on now, with what it cost (§5). Null when it is
 * not the CPU's turn. Deterministic: the same session gives the same answer.
 */
export function planCpuMove(session: ChessSession): CpuDecision | null {
  if (!isCpuTurn(session)) return null;
  return decideCpuMove({
    position: session.game.position,
    history: session.game.history,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.game.moves.length,
  });
}

export interface CpuMoveOutcome extends MoveOutcome {
  readonly decision: CpuDecision;
}

/** The CPU decides and plays its move (§5). Null when it is not the CPU's turn. */
export function applyCpuMove(session: ChessSession): CpuMoveOutcome | null {
  const decision = planCpuMove(session);
  if (decision === null) return null;
  const game = cloneGame(session.game);
  if (!playMove(game, decision.move)) return null;
  return { session: { ...session, game }, move: decision.move, decision };
}

/**
 * Whether Undo can do anything (§6): the game is still going and there is an
 * earlier position where it was the player's move. A game the CPU opened, with
 * only that first move on the board, has none.
 */
export function canUndo(session: ChessSession): boolean {
  if (isOver(session)) return false;
  const plies = session.game.moves.length;
  // The player's decision points are the plies where their colour moves:
  // the even ones for White, the odd ones for Black.
  return session.playerColor === WHITE ? plies >= 1 : plies >= 2;
}

/**
 * Back to the player's previous decision point (§6): during the player's turn
 * that takes back the CPU's reply and the player's move before it; during the
 * CPU's turn (the 450 ms pause) only the player's move — the planned CPU move
 * is simply never played. Null when there is nothing to take back.
 */
export function undo(session: ChessSession): ChessSession | null {
  if (!canUndo(session)) return null;
  const game = cloneGame(session.game);
  do {
    undoMove(game);
  } while (game.position.side !== session.playerColor);
  return { ...session, game };
}

export const withElapsed = (session: ChessSession, elapsedSeconds: number): ChessSession => ({
  ...session,
  elapsedSeconds,
});

/** The saved move list (§7.1). */
export const encodeSessionMoves = (session: ChessSession): string =>
  encodeMoveList(session.game.moves);

export interface SavedSessionFields {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly playerColor: Color;
  readonly moves: unknown;
  readonly elapsedSeconds: number;
}

/**
 * A session from saved fields (§7.1), or null when the move list does not
 * replay — or replays to a finished game, which is not a game to resume. The
 * caller (storage) has already checked the other fields' shapes; this owns
 * the move list's meaning.
 */
export function restoreSession(saved: SavedSessionFields): ChessSession | null {
  if (saved.playerColor !== WHITE && saved.playerColor !== BLACK) return null;
  const game = decodeMoveList(saved.moves);
  if (game === null || game.outcome !== null) return null;
  return {
    seed: saved.seed,
    difficulty: saved.difficulty,
    playerColor: saved.playerColor,
    game,
    elapsedSeconds: saved.elapsedSeconds,
  };
}
