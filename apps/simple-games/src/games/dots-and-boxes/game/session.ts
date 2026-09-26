/**
 * DotsAndBoxesSession — a pure, immutable snapshot of one match in progress:
 * board + whose turn + the last line + undo history. The React layer only
 * dispatches into these functions; all rules live here, in engine.ts and in
 * cpu.ts.
 *
 * The turn is part of the state rather than derived from it: closing a box
 * keeps the move (§2), so the board alone cannot say whose line is next.
 *
 * Undo is the one help this title offers, and it is free and unlimited (§5).
 * It steps back to the player's previous decision point — the CPU's run of
 * lines comes off with the player's, because a position mid-CPU-run is not a
 * place a player ever decided anything. It is a take-back, not a reroll: the
 * CPU's choice is decided by the seed and the move count (§4).
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for
 * the statistics only.
 */
import { chooseCpuMove } from './cpu';
import { claim, countBoxes, isFinished } from './engine';
import {
  BOXES_FOR,
  CPU,
  emptyBoard,
  PLAYER,
  type Board,
  type BoardSize,
  type GameStatus,
  type Side,
} from './types';

/** Practically unlimited undo: a 5×5 board is sixty lines in all (§5). */
export const UNDO_HISTORY_LIMIT = 100;

/** The line just drawn, for the screen's highlight and sounds (§10). */
export interface LastMove {
  readonly by: Side;
  readonly edge: number;
  /** Boxes that line closed (§2). */
  readonly completed: readonly number[];
  /** Identity: one screen effect per line, replays excluded. */
  readonly moveCount: number;
}

/** One decision point: the position the player drew from (§5). */
export interface HistoryEntry {
  readonly board: Board;
  readonly toMove: Side;
  readonly moveCount: number;
}

export interface DotsAndBoxesSession {
  readonly seed: string;
  readonly size: BoardSize;
  readonly board: Board;
  /** Whose line it is. Meaningless once the status is terminal. */
  readonly toMove: Side;
  /** From the player's side of the table: 'won' means the player did (§3). */
  readonly status: GameStatus;
  readonly lastMove: LastMove | null;
  /** Snapshots taken before each of the player's lines, oldest first. */
  readonly history: readonly HistoryEntry[];
  /** Lines drawn this match, by either side. The CPU draw's second half (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets a new deal — while the seed
 * still pins the CPU down completely, which is what §5 rests on.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const matchSeed = (token: string): string => `dots-and-boxes-${token}`;

/** A fresh match. The player always draws first (§1). */
export function createSession(
  size: BoardSize,
  seed: string = matchSeed(newSeedToken()),
): DotsAndBoxesSession {
  return {
    seed,
    size,
    board: emptyBoard(BOXES_FOR[size]),
    toMove: PLAYER,
    status: 'playing',
    lastMove: null,
    history: [],
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** What a board says about the match: still going, or who has more boxes (§3). */
export function statusOf(board: Board): GameStatus {
  if (!isFinished(board)) return 'playing';
  const { player, cpu } = countBoxes(board);
  return player > cpu ? 'won' : player < cpu ? 'lost' : 'draw';
}

/** One line drawn by `side`: the new board, the turn, and the end if it came. */
function draw(session: DotsAndBoxesSession, side: Side, edge: number): DotsAndBoxesSession | null {
  const outcome = claim(session.board, side, edge);
  if (outcome === null) return null;
  const moveCount = session.moveCount + 1;
  return {
    ...session,
    board: outcome.board,
    toMove: outcome.keepsTurn ? side : side === PLAYER ? CPU : PLAYER,
    status: statusOf(outcome.board),
    lastMove: { by: side, edge, completed: outcome.completed, moveCount },
    moveCount,
  };
}

/**
 * The player draws a line (§2). Returns null when it is not the player's
 * turn or the edge is already drawn — that input is nothing, silently.
 */
export function applyPlayerMove(
  session: DotsAndBoxesSession,
  edge: number,
): DotsAndBoxesSession | null {
  if (session.status !== 'playing' || session.toMove !== PLAYER) return null;
  const next = draw(session, PLAYER, edge);
  if (next === null) return null;

  const history = [
    ...session.history,
    { board: session.board, toMove: session.toMove, moveCount: session.moveCount },
  ];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();
  return { ...next, history };
}

/**
 * The CPU draws one line (§4). Returns null when it is not the CPU's turn —
 * the caller schedules this off the session state, and a stale schedule must
 * land as nothing. A line that closes a box leaves the turn with the CPU, and
 * the caller's schedule simply fires again (§4).
 */
export function applyCpuMove(session: DotsAndBoxesSession): DotsAndBoxesSession | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const edge = chooseCpuMove({
    board: session.board,
    seed: session.seed,
    moveCount: session.moveCount,
  });
  return draw(session, CPU, edge);
}

export function canUndo(session: DotsAndBoxesSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes the match back to the player's previous decision point (§5).
 * Returns null when there is nothing to take back.
 */
export function undo(session: DotsAndBoxesSession): DotsAndBoxesSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    toMove: previous.toMove,
    status: 'playing',
    lastMove: null,
    history: session.history.slice(0, -1),
    moveCount: previous.moveCount,
  };
}

/**
 * Restores a session from persisted state. The undo history does not survive
 * a save (§8), and neither does a finished match: a board with every line
 * drawn makes the status terminal, so the loader can discard it.
 */
export function restoreSession(data: {
  readonly seed: string;
  readonly size: BoardSize;
  readonly board: Board;
  readonly toMove: Side;
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}): DotsAndBoxesSession {
  return {
    ...data,
    status: statusOf(data.board),
    lastMove: null,
    history: [],
  };
}
