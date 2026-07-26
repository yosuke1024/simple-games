/**
 * GameSession — a pure, immutable snapshot of one game in progress:
 * board + undo history + status + counters. The React layer only dispatches
 * into these functions; all rules live here and in engine.ts.
 */
import { generateInitialBoard } from './board';
import { MAX_CELLS, UNDO_HISTORY_LIMIT } from './constants';
import { addNumbers, applyMatch, getStatus } from './engine';
import type { Board, GameMode, GameStatus } from './types';

/** Snapshot taken before a mutation, tagged so undo can revert counters. */
export interface HistoryEntry {
  readonly board: Board;
  readonly action: 'match' | 'add';
}

export interface GameSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Local YYYY-MM-DD for daily mode, null for classic. */
  readonly dailyDate: string | null;
  readonly board: Board;
  /** Board snapshots before each mutation (match / add numbers). */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  readonly moveCount: number;
  readonly addCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

export function createSession(
  mode: GameMode,
  seed: string,
  dailyDate: string | null = null,
): GameSession {
  const board = generateInitialBoard(seed);
  return {
    mode,
    seed,
    dailyDate,
    board,
    history: [],
    status: getStatus(board),
    moveCount: 0,
    addCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(
  data: Pick<
    GameSession,
    'mode' | 'seed' | 'dailyDate' | 'board' | 'moveCount' | 'addCount' | 'hintCount' | 'elapsedSeconds'
  >,
): GameSession {
  return {
    ...data,
    history: [],
    status: getStatus(data.board),
  };
}

function pushHistory(
  history: readonly HistoryEntry[],
  board: Board,
  action: 'match' | 'add',
): readonly HistoryEntry[] {
  const next = [...history, { board, action }];
  if (next.length > UNDO_HISTORY_LIMIT) next.shift();
  return next;
}

/** Clears a valid pair. Returns null when the pair is invalid. */
export function matchPair(session: GameSession, i: number, j: number): GameSession | null {
  if (session.status !== 'playing') return null;
  const board = applyMatch(session.board, i, j);
  if (board === null) return null;
  return {
    ...session,
    board,
    history: pushHistory(session.history, session.board, 'match'),
    status: getStatus(board),
    moveCount: session.moveCount + 1,
  };
}

/** Performs Add Numbers. Returns null when not allowed. */
export function performAddNumbers(session: GameSession): GameSession | null {
  if (session.status !== 'playing') return null;
  const board = addNumbers(session.board, MAX_CELLS);
  if (board === null) return null;
  return {
    ...session,
    board,
    history: pushHistory(session.history, session.board, 'add'),
    status: getStatus(board),
    addCount: session.addCount + 1,
  };
}

export function canUndo(session: GameSession): boolean {
  return session.history.length > 0;
}

/** Reverts the last mutation. Returns null when there is nothing to undo. */
export function undo(session: GameSession): GameSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    history: session.history.slice(0, -1),
    status: getStatus(previous.board),
    moveCount:
      previous.action === 'match' ? Math.max(0, session.moveCount - 1) : session.moveCount,
    addCount: previous.action === 'add' ? Math.max(0, session.addCount - 1) : session.addCount,
  };
}

/** Adds play time (driven by the UI clock; pure here for testability). */
export function tickSeconds(session: GameSession, seconds: number): GameSession {
  if (session.status !== 'playing' || seconds <= 0) return session;
  return { ...session, elapsedSeconds: session.elapsedSeconds + seconds };
}

export function countHintUse(session: GameSession): GameSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

export type { GameStatus };
