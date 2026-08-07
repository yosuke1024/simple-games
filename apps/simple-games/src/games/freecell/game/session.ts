/**
 * FreeCellSession — a pure, immutable snapshot of one game in progress:
 * board + undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the move count along with the board (§8): the move count
 * describes the board you are looking at, so putting the board back puts the
 * count back. One undo takes back one move, and a supermove is one move —
 * the run comes back whole, not card by card.
 *
 * There is no hint count here, because FreeCell has no hint (§8): every card
 * is face up, so telling a player the next move is not a nudge, it is playing
 * the game for them. There is no clock on screen either (§4); elapsed seconds
 * are carried for the result screen and the statistics only.
 */
import { dailySeed } from './daily';
import { dealBoard } from './deal';
import {
  autoFinish,
  hasAnyMove,
  isWon,
  moveCascadeRun,
  moveCascadeToCell,
  moveCascadeToFoundation,
  moveCellToCascade,
  moveCellToFoundation,
} from './engine';
import type { FreeCellBoard, GameMode, GameStatus } from './types';

/** Practically unlimited undo; a real game never comes close (§8). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and the move count that went with it. */
export interface HistoryEntry {
  readonly board: FreeCellBoard;
  readonly moveCount: number;
}

export interface FreeCellSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Local YYYY-MM-DD for daily mode, null for free mode. */
  readonly dailyDate: string | null;
  readonly board: FreeCellBoard;
  /** Board snapshots before each move, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Moves so far — a supermove is one, however many cards it carried (§4). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one free deal's seed its own. Free mode has no levels
 * and no dates to seed from (§5), so a new game gets a new deal — while the
 * seed still pins that deal down completely, which is what makes "retry the
 * same deal" exact.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (token: string): string => `fc-free-${token}`;

function baseSession(mode: GameMode, seed: string, dailyDate: string | null): FreeCellSession {
  return {
    mode,
    seed,
    dailyDate,
    board: dealBoard(seed),
    history: [],
    status: 'playing',
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh free deal — a new game unless a seed pins an old one (§5). */
export function createFreeSession(seed: string = freeSeed(newSeedToken())): FreeCellSession {
  return baseSession('free', seed, null);
}

/** The daily deal for a local YYYY-MM-DD date (§6). */
export function createDailySession(dateString: string): FreeCellSession {
  return baseSession('daily', dailySeed(dateString), dateString);
}

/** The same deal again (§5): same seed, memory kept. */
export function restartSession(session: FreeCellSession): FreeCellSession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate)
    : createFreeSession(session.seed);
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(data: Omit<FreeCellSession, 'history' | 'status'>): FreeCellSession {
  return {
    ...data,
    history: [],
    status: isWon(data.board) ? 'won' : 'playing',
  };
}

/** Applies a board transition as one counted move (§4). */
function played(
  session: FreeCellSession,
  board: FreeCellBoard | null,
  moves = 1,
): FreeCellSession | null {
  if (board === null) return null;
  const history = [...session.history, { board: session.board, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();
  return {
    ...session,
    board,
    history,
    moveCount: session.moveCount + moves,
    status: isWon(board) ? 'won' : 'playing',
  };
}

const playing = (session: FreeCellSession): boolean => session.status === 'playing';

export function doMoveCascadeToCell(
  session: FreeCellSession,
  from: number,
  toCell?: number,
): FreeCellSession | null {
  if (!playing(session)) return null;
  return played(session, moveCascadeToCell(session.board, from, toCell));
}

export function doMoveCascadeToFoundation(
  session: FreeCellSession,
  from: number,
): FreeCellSession | null {
  if (!playing(session)) return null;
  return played(session, moveCascadeToFoundation(session.board, from));
}

export function doMoveCellToCascade(
  session: FreeCellSession,
  cell: number,
  to: number,
): FreeCellSession | null {
  if (!playing(session)) return null;
  return played(session, moveCellToCascade(session.board, cell, to));
}

export function doMoveCellToFoundation(
  session: FreeCellSession,
  cell: number,
): FreeCellSession | null {
  if (!playing(session)) return null;
  return played(session, moveCellToFoundation(session.board, cell));
}

export function doMoveCascadeRun(
  session: FreeCellSession,
  from: number,
  index: number,
  to: number,
): FreeCellSession | null {
  if (!playing(session)) return null;
  return played(session, moveCascadeRun(session.board, from, index, to));
}

/** Runs the endgame; every card moved counts as a move (§7). */
export function doAutoFinish(session: FreeCellSession): FreeCellSession | null {
  if (!playing(session)) return null;
  const result = autoFinish(session.board);
  if (!result) return null;
  return played(session, result.board, result.moved);
}

export function canUndo(session: FreeCellSession): boolean {
  return session.history.length > 0;
}

/** Takes back one move — board and move count together (§8). */
export function undo(session: FreeCellSession): FreeCellSession | null {
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

/**
 * Whether the game is over with cards still on the table (§2). Undo is always
 * there, so this is a statement of fact rather than a verdict — the player can
 * step back out of the dead end, retry the same deal, or take a new one, all
 * free and unlimited.
 */
export function isStuck(session: FreeCellSession): boolean {
  return session.status === 'playing' && !hasAnyMove(session.board);
}
