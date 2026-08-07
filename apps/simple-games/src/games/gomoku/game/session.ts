/**
 * GomokuSession — a pure, immutable snapshot of one match in progress: board
 * + whose turn + undo history. The React layer only dispatches into these
 * functions; all rules live here, in engine.ts and in cpu.ts.
 *
 * Undo is the one help this title offers, and it is free and unlimited (§5).
 * It steps back to the player's previous decision point — the CPU's reply
 * comes off with the player's stone, because a position mid-CPU-turn is not a
 * place a player ever decided anything. It is a take-back, not a reroll: the
 * CPU's choice is decided by the seed and the move count (§4), so putting the
 * board back and playing the same intersection brings the same reply.
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for the
 * statistics only.
 */
import { chooseCpuMove } from './cpu';
import { findWinner, isBoardFull, lineThrough, placeStone } from './engine';
import {
  BLACK,
  emptyBoard,
  opponentOf,
  sideToMove,
  type Board,
  type Difficulty,
  type GameStatus,
  type Player,
} from './types';

/** Practically unlimited undo; a match is at most 225 stones (§5). */
export const UNDO_HISTORY_LIMIT = 240;

/** One decision point: the position the player played from. */
export interface HistoryEntry {
  readonly board: Board;
  readonly moveCount: number;
}

export interface GomokuSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /**
   * The colour the player holds this match — their choice, taken before the
   * first stone (§1). Black opens, so this is also the choice of first or
   * second; the CPU holds the other colour.
   */
  readonly playerColor: Player;
  readonly board: Board;
  /** Whose colour is to play. Meaningless once the status is terminal. */
  readonly toMove: Player;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  /** The completed line, for the screen's ring — null while playing (§10). */
  readonly winningLine: readonly number[] | null;
  /** Snapshots taken before each of the player's stones, oldest first. */
  readonly history: readonly HistoryEntry[];
  /** Stones played this match, by either side. The CPU draw's second half (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new one — while the seed
 * still pins the CPU down completely, which is what §5 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `gomoku-${token}`;

/** The CPU's colour: whichever one the player did not take (§1). */
export const cpuColorOf = (session: GomokuSession): Player => opponentOf(session.playerColor);

/**
 * A fresh match. `playerColor` is the player's choice (§1); taking white means
 * the session starts on the CPU's turn, which the screen plays out the same
 * way it plays out any other CPU turn.
 */
export function createSession(
  difficulty: Difficulty,
  playerColor: Player = BLACK,
  seed: string = matchSeed(newSeedToken()),
): GomokuSession {
  return {
    seed,
    difficulty,
    playerColor,
    board: emptyBoard(),
    toMove: BLACK,
    status: 'playing',
    winningLine: null,
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

export interface MoveOutcome {
  readonly session: GomokuSession;
  /** Where the stone landed, for the placement animation (§10). */
  readonly placed: number;
}

/** What one stone makes of the match: a win, a full board, or the other turn. */
function settle(session: GomokuSession, board: Board, cell: number, mover: Player): GomokuSession {
  const line = lineThrough(board, cell);
  const status: GameStatus =
    line !== null
      ? mover === session.playerColor
        ? 'won'
        : 'lost'
      : isBoardFull(board)
        ? 'draw'
        : 'playing';
  return {
    ...session,
    board,
    toMove: opponentOf(mover),
    status,
    winningLine: line,
    moveCount: session.moveCount + 1,
  };
}

/**
 * The player plays a stone (§2). Returns null when it is not the player's
 * turn or the intersection is taken — the screen never offers a taken one, so
 * this is the belt to the screen's braces rather than a message.
 */
export function applyPlayerMove(session: GomokuSession, cell: number): MoveOutcome | null {
  if (session.status !== 'playing' || session.toMove !== session.playerColor) return null;
  const board = placeStone(session.board, session.playerColor, cell);
  if (board === null) return null;

  const history = [...session.history, { board: session.board, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return {
    session: { ...settle(session, board, cell, session.playerColor), history },
    placed: cell,
  };
}

/**
 * The CPU takes its turn (§4). Returns null when it is not the CPU's turn —
 * the caller schedules this off the session state, and a stale schedule must
 * land as nothing.
 */
export function applyCpuMove(session: GomokuSession): MoveOutcome | null {
  const cpuColor = cpuColorOf(session);
  if (session.status !== 'playing' || session.toMove !== cpuColor) return null;
  const cell = chooseCpuMove({
    board: session.board,
    player: cpuColor,
    difficulty: session.difficulty,
    seed: session.seed,
    moveCount: session.moveCount,
  });
  if (cell === null) return null;
  const board = placeStone(session.board, cpuColor, cell);
  if (board === null) return null;
  return { session: settle(session, board, cell, cpuColor), placed: cell };
}

export function canUndo(session: GomokuSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§5).
 * Returns null when there is nothing to take back.
 */
export function undo(session: GomokuSession): GomokuSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    toMove: sideToMove(previous.board),
    status: 'playing',
    winningLine: null,
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§8), and neither does a finished match: any completed line on the
 * board makes the status terminal, so the loader can discard it.
 *
 * The turn is derived rather than stored: black opens and nobody passes, so
 * the stone counts say whose move it is on their own (§1, types.ts).
 */
export function restoreSession(
  data: Omit<GomokuSession, 'history' | 'status' | 'toMove' | 'winningLine'>,
): GomokuSession {
  const winner = findWinner(data.board);
  const status: GameStatus =
    winner !== null
      ? winner.player === data.playerColor
        ? 'won'
        : 'lost'
      : isBoardFull(data.board)
        ? 'draw'
        : 'playing';
  return {
    ...data,
    toMove: sideToMove(data.board),
    status,
    winningLine: winner?.line ?? null,
    history: [],
  };
}
