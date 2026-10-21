/**
 * NestedSession — a pure, immutable snapshot of one match in progress
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §1, §3, §5). The React layer only
 * dispatches into these functions; the rules live in engine.ts and the
 * opponent in cpu.ts.
 *
 * The match *is* its move list. The marks, the small boards, whose turn it
 * is and where the next move goes all derive from it (§1), so the session
 * stores the list and a derived view of the board for the screen — nothing
 * that could disagree with the list. That is also why Undo needs no history
 * of its own (§5): taking moves off the end of the list is the history, and
 * it survives a save and a resume for free (§8).
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for the
 * statistics only.
 */
import { decideCpuMove } from './cpu';
import {
  isFreeMove,
  isLegalMove,
  legalMoves,
  makeMove,
  playableBoards,
  positionFromMoves,
  takenCount,
  toMove,
  winningLine,
  type Position,
} from './engine';
import {
  boardOf,
  DRAWN,
  markToMove,
  ONGOING,
  otherMark,
  playerMarkOf,
  type Cell,
  type Difficulty,
  type GameStatus,
  type Mark,
  type SmallState,
} from './types';

/** What the screen draws, derived from the move list (§10). */
export interface BoardView {
  readonly cells: readonly Cell[];
  readonly smalls: readonly SmallState[];
  /** The cells the side to move may play — empty once the match is over. */
  readonly legal: readonly number[];
  /** The small boards the side to move may play in — framed when it is the player's turn (§10). */
  readonly playable: readonly number[];
  /** True when the side to move was not sent anywhere (first move, or a closed target — §2). */
  readonly freeMove: boolean;
  /** The big-board line that won, as small-board indexes, or null (§10). */
  readonly winningLine: readonly number[] | null;
  readonly lastMove: number | null;
}

export interface NestedSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** True = the player holds cross and moves first (§1). Fixed for the match. */
  readonly playerGoesFirst: boolean;
  /** Every move so far, oldest first — cells 0–80 (§1, §8.1). */
  readonly moves: readonly number[];
  /** From the player's side: changes once, from 'playing' (§3 6). */
  readonly status: GameStatus;
  readonly view: BoardView;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own (the form of Reversi's): the
 * clock in base 36 plus a random part. The only randomness the seed feeds is
 * the CPU's tie draw and easy's wobble (§4.1).
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `nested-tic-tac-toe-${token}`;

export const playerMark = (session: NestedSession): Mark => playerMarkOf(session.playerGoesFirst);
export const cpuMark = (session: NestedSession): Mark => otherMark(playerMark(session));

function statusOf(position: Position, player: Mark): GameStatus {
  if (position.result === ONGOING) return 'playing';
  if (position.result === DRAWN) return 'draw';
  return position.result === player ? 'won' : 'lost';
}

function viewOf(position: Position): BoardView {
  const { moves } = position;
  const playable = playableBoards(position);
  return {
    cells: Array.from(position.cells) as Cell[],
    smalls: Array.from(position.smalls) as SmallState[],
    legal: legalMoves(position),
    playable,
    freeMove: isFreeMove(position),
    winningLine: winningLine(position),
    lastMove: moves.length > 0 ? moves[moves.length - 1]! : null,
  };
}

function withPosition(session: NestedSession, position: Position): NestedSession {
  return {
    ...session,
    moves: [...position.moves],
    status: statusOf(position, playerMarkOf(session.playerGoesFirst)),
    view: viewOf(position),
  };
}

/**
 * A fresh match. Moving second means the CPU opens, so the session starts on
 * the CPU's turn and the screen plays it out like any other CPU turn (§4).
 */
export function createSession(
  difficulty: Difficulty,
  playerGoesFirst = true,
  seed: string = matchSeed(newSeedToken()),
): NestedSession {
  const position = positionFromMoves([])!;
  return {
    seed,
    difficulty,
    playerGoesFirst,
    moves: [],
    status: 'playing',
    view: viewOf(position),
    elapsedSeconds: 0,
  };
}

export const isPlayerTurn = (session: NestedSession): boolean =>
  session.status === 'playing' && markToMove(session.moves.length) === playerMark(session);

export const isCpuTurn = (session: NestedSession): boolean =>
  session.status === 'playing' && markToMove(session.moves.length) === cpuMark(session);

export interface MoveOutcome {
  readonly session: NestedSession;
  /** The cell the mark went on, for the pop and the last-move bar (§10). */
  readonly placed: number;
  /** True when the move took its small board — the `match` sound and the fade (§10). */
  readonly took: boolean;
}

function play(session: NestedSession, cell: number): MoveOutcome | null {
  const position = positionFromMoves(session.moves);
  if (position === null || !isLegalMove(position, cell)) return null;
  const mover = toMove(position);
  makeMove(position, cell);
  return {
    session: withPosition(session, position),
    placed: cell,
    took: position.smalls[boardOf(cell)] === mover,
  };
}

/**
 * The player plays a cell (§2). Null when it is not the player's turn, the
 * match is over, or the cell is not a legal move — the screen only enables
 * legal cells, so anything else is nothing, silently (§2).
 */
export function applyPlayerMove(session: NestedSession, cell: number): MoveOutcome | null {
  if (!isPlayerTurn(session)) return null;
  return play(session, cell);
}

/**
 * The CPU takes its turn (§4). Null when it is not the CPU's turn — the
 * caller schedules this off the session state, and a stale timer must land
 * as nothing.
 */
export function applyCpuMove(session: NestedSession): MoveOutcome | null {
  if (!isCpuTurn(session)) return null;
  const decision = decideCpuMove({
    moves: session.moves,
    difficulty: session.difficulty,
    seed: session.seed,
  });
  if (decision === null) return null;
  return play(session, decision.cell);
}

/** True when the list holds a move of the player's and the match is still going (§5). */
export function canUndo(session: NestedSession): boolean {
  if (session.status !== 'playing') return false;
  const first = session.playerGoesFirst ? 0 : 1;
  return session.moves.length > first;
}

/**
 * Back to the player's previous decision point (§5): moves come off the end
 * of the list until one of the player's has. After the CPU's reply that is
 * the reply and the player's move together; during the CPU's pause it is the
 * player's move alone. Null when the match is over or the player has no move
 * to take back (the CPU's opening move, when the player went second).
 */
export function undo(session: NestedSession): NestedSession | null {
  if (!canUndo(session)) return null;
  const player = playerMark(session);
  const moves = [...session.moves];
  while (moves.length > 0) {
    const mover = markToMove(moves.length - 1);
    moves.pop();
    if (mover === player) break;
  }
  const position = positionFromMoves(moves)!;
  return withPosition(session, position);
}

/** Small boards each side holds — the result card's facts (§7, §10). */
export function takenBoards(session: NestedSession): { player: number; cpu: number } {
  const position = positionFromMoves(session.moves)!;
  return {
    player: takenCount(position, playerMark(session)),
    cpu: takenCount(position, cpuMark(session)),
  };
}

export interface SessionRecord {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly playerGoesFirst: boolean;
  readonly moves: readonly number[];
  readonly elapsedSeconds: number;
}

/**
 * A session from persisted state (§8.2), or null when the moves do not
 * replay legally from the empty board or the replayed match is already over
 * — a finished match is never saved, so one in storage is not to be trusted.
 */
export function restoreSession(record: SessionRecord): NestedSession | null {
  const position = positionFromMoves(record.moves);
  if (position === null || position.result !== ONGOING) return null;
  const base: NestedSession = {
    seed: record.seed,
    difficulty: record.difficulty,
    playerGoesFirst: record.playerGoesFirst,
    moves: [],
    status: 'playing',
    view: viewOf(position),
    elapsedSeconds: record.elapsedSeconds,
  };
  return withPosition(base, position);
}
