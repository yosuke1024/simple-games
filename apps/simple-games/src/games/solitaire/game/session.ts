/**
 * SolitaireSession — a pure, immutable snapshot of one game in progress:
 * board + undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the move count along with the board (§8): the move count
 * describes the board you are looking at, so putting the board back puts the
 * count back — and a card that had flipped face up goes back face down, since
 * the flip was part of the move.
 *
 * There is no clock on screen (§4); elapsed seconds are carried here for the
 * result screen and the statistics only.
 */
import { dailySeed } from './daily';
import { dealBoard } from './deal';
import {
  autoFinish,
  draw,
  isWon,
  moveFoundationToTableau,
  moveTableauRun,
  moveTableauToFoundation,
  moveWasteToFoundation,
  moveWasteToTableau,
} from './engine';
import type { GameMode, GameStatus, SolitaireBoard } from './types';

/** Practically unlimited undo; a real game never comes close (§8). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and the move count that went with it. */
export interface HistoryEntry {
  readonly board: SolitaireBoard;
  readonly moveCount: number;
}

export interface SolitaireSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Draw 3 when true, draw 1 otherwise (§4). Fixed for the deal's life. */
  readonly drawThree: boolean;
  /** Local YYYY-MM-DD for daily mode, null for free mode. */
  readonly dailyDate: string | null;
  readonly board: SolitaireBoard;
  /** Board snapshots before each move, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Moves so far — every move, draw and redeal included (§4). */
  readonly moveCount: number;
  /** Hints asked and answered — a fact for the result screen, never a cost. */
  readonly hintCount: number;
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

export const freeSeed = (token: string): string => `sol-free-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  drawThree: boolean,
  dailyDate: string | null,
): SolitaireSession {
  return {
    mode,
    seed,
    drawThree,
    dailyDate,
    board: dealBoard(seed),
    history: [],
    status: 'playing',
    moveCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh free deal — a new game unless a seed pins an old one (§5). */
export function createFreeSession(
  drawThree: boolean,
  seed: string = freeSeed(newSeedToken()),
): SolitaireSession {
  return baseSession('free', seed, drawThree, null);
}

/** The daily deal for a local YYYY-MM-DD date (§6). */
export function createDailySession(dateString: string, drawThree: boolean): SolitaireSession {
  return baseSession('daily', dailySeed(dateString), drawThree, dateString);
}

/** The same deal again (§5): same seed, same draw setting, memory kept. */
export function restartSession(session: SolitaireSession): SolitaireSession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate, session.drawThree)
    : createFreeSession(session.drawThree, session.seed);
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(
  data: Omit<SolitaireSession, 'history' | 'status'>,
): SolitaireSession {
  return {
    ...data,
    history: [],
    status: isWon(data.board) ? 'won' : 'playing',
  };
}

/** Applies a board transition as one counted move (§4). */
function played(
  session: SolitaireSession,
  board: SolitaireBoard | null,
  moves = 1,
): SolitaireSession | null {
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

const playing = (session: SolitaireSession): boolean => session.status === 'playing';

/** Draws (or, on an empty stock, turns the waste back over) — one move (§3). */
export function doDraw(session: SolitaireSession): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, draw(session.board, session.drawThree ? 3 : 1));
}

export function doMoveTableauRun(
  session: SolitaireSession,
  from: number,
  index: number,
  to: number,
): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, moveTableauRun(session.board, from, index, to));
}

export function doMoveTableauToFoundation(
  session: SolitaireSession,
  from: number,
): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, moveTableauToFoundation(session.board, from));
}

export function doMoveWasteToTableau(
  session: SolitaireSession,
  to: number,
): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, moveWasteToTableau(session.board, to));
}

export function doMoveWasteToFoundation(session: SolitaireSession): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, moveWasteToFoundation(session.board));
}

export function doMoveFoundationToTableau(
  session: SolitaireSession,
  suit: number,
  to: number,
): SolitaireSession | null {
  if (!playing(session)) return null;
  return played(session, moveFoundationToTableau(session.board, suit, to));
}

/** Runs the endgame; every card moved counts as a move (§7). */
export function doAutoFinish(session: SolitaireSession): SolitaireSession | null {
  if (!playing(session)) return null;
  const result = autoFinish(session.board);
  if (!result) return null;
  return played(session, result.board, result.moved);
}

export function canUndo(session: SolitaireSession): boolean {
  return session.history.length > 0;
}

/** Takes back one move — board and move count together (§8). */
export function undo(session: SolitaireSession): SolitaireSession | null {
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
export function recordHint(session: SolitaireSession): SolitaireSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
