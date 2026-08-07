/**
 * SpiderSession — a pure, immutable snapshot of one game in progress: board +
 * undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the move count along with the board (§8): the move count
 * describes the board you are looking at. Because the history holds whole
 * boards, one undo also takes back everything the move dragged along with it —
 * a card that turned over, a run that left the table, a whole row that was
 * dealt.
 */
import { dailySeed } from './daily';
import { dealBoard } from './deal';
import { dealRow, isWon, moveRun } from './engine';
import { hasAnyMove } from './hint';
import type { GameMode, GameStatus, SpiderBoard, SuitCount } from './types';

/** Practically unlimited undo; a real game never comes close (§8). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and the move count that went with it. */
export interface HistoryEntry {
  readonly board: SpiderBoard;
  readonly moveCount: number;
}

export interface SpiderSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Fixed for the deal's life; the home screen's toggle applies from the next one (§ difficulty). */
  readonly suitCount: SuitCount;
  /** Local YYYY-MM-DD for daily mode, null for free mode. */
  readonly dailyDate: string | null;
  readonly board: SpiderBoard;
  /** Board snapshots before each move, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Moves so far — every run moved and every row dealt (§4). */
  readonly moveCount: number;
  /** Hints asked and answered — a fact for the result screen, never a cost. */
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one free deal's seed its own. Free mode has no levels and
 * no dates to seed from (§5), so a new game gets a new deal — while the seed
 * still pins that deal down completely, which is what makes "retry the same
 * deal" exact.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (token: string): string => `ss-free-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  suitCount: SuitCount,
  dailyDate: string | null,
): SpiderSession {
  return {
    mode,
    seed,
    suitCount,
    dailyDate,
    board: dealBoard(seed, suitCount),
    history: [],
    status: 'playing',
    moveCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh free deal — a new game unless a seed pins an old one (§5). */
export function createFreeSession(
  suitCount: SuitCount,
  seed: string = freeSeed(newSeedToken()),
): SpiderSession {
  return baseSession('free', seed, suitCount, null);
}

/** The daily deal for a local YYYY-MM-DD date (§6), at the chosen difficulty. */
export function createDailySession(dateString: string, suitCount: SuitCount): SpiderSession {
  return baseSession('daily', dailySeed(dateString), suitCount, dateString);
}

/** The same deal again (§5): same seed, same difficulty, memory kept. */
export function restartSession(session: SpiderSession): SpiderSession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate, session.suitCount)
    : createFreeSession(session.suitCount, session.seed);
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(data: Omit<SpiderSession, 'history' | 'status'>): SpiderSession {
  return {
    ...data,
    history: [],
    status: isWon(data.board) ? 'won' : 'playing',
  };
}

/** Applies a board transition as one counted move (§4). */
function played(session: SpiderSession, board: SpiderBoard | null): SpiderSession | null {
  if (board === null) return null;
  const history = [...session.history, { board: session.board, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();
  return {
    ...session,
    board,
    history,
    moveCount: session.moveCount + 1,
    status: isWon(board) ? 'won' : 'playing',
  };
}

const playing = (session: SpiderSession): boolean => session.status === 'playing';

export function doMoveRun(
  session: SpiderSession,
  from: number,
  index: number,
  to: number,
): SpiderSession | null {
  if (!playing(session)) return null;
  return played(session, moveRun(session.board, from, index, to));
}

/** Deals one row — one move, whatever it completes on the way down (§4). */
export function doDeal(session: SpiderSession): SpiderSession | null {
  if (!playing(session)) return null;
  return played(session, dealRow(session.board));
}

export function canUndo(session: SpiderSession): boolean {
  return session.history.length > 0;
}

/** Takes back one move — board and move count together (§8). */
export function undo(session: SpiderSession): SpiderSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous.board,
    moveCount: previous.moveCount,
    history: session.history.slice(0, -1),
    status: isWon(previous.board) ? 'won' : 'playing',
  };
}

/** Books an answered hint (§8). The board itself is untouched. */
export function recordHint(session: SpiderSession): SpiderSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

/**
 * Whether the game is over with cards still on the table (§2): the stock is
 * spent and nothing can move. Undo is always there, so this is a statement of
 * fact rather than a verdict.
 */
export function isStuck(session: SpiderSession): boolean {
  return session.status === 'playing' && !hasAnyMove(session.board);
}
