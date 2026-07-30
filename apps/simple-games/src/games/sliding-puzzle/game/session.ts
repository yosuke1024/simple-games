/**
 * SlidingPuzzleSession — a pure, immutable snapshot of one game in progress:
 * board + undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the move count along with the board (§8). That is the opposite
 * of Sudoku's mistake counter, and deliberately so: a mistake is a thing that
 * happened, while the move count describes the board you are looking at. Put
 * the board back and the count that produced it goes back too.
 *
 * There is no clock on screen (§4); elapsed seconds are carried here for the
 * clear screen and the statistics only.
 */
import { DAILY_DEPTH, DAILY_SIZE, dailySeed } from './daily';
import { applyMove, isSolved } from './engine';
import { generatePuzzle } from './generator';
import { levelSeed, shuffleDepthForLevel, sizeForLevel } from './levels';
import type { GameMode, GameStatus, Size, Tiles } from './types';

/** Practically unlimited undo; a real game never comes close (§8). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and the move count that went with it. */
export interface HistoryEntry {
  readonly tiles: Tiles;
  readonly moveCount: number;
}

export interface SlidingPuzzleSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..999 for level mode, null for daily. */
  readonly level: number | null;
  readonly tiles: Tiles;
  /** Board snapshots before each move, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Tiles moved so far — a multi-tile slide costs its whole width (§3). */
  readonly moveCount: number;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  dailyDate: string | null,
  level: number | null,
  tiles: Tiles,
): SlidingPuzzleSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    tiles,
    history: [],
    status: isSolved(tiles, size) ? 'solved' : 'playing',
    moveCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level. */
export function createLevelSession(level: number): SlidingPuzzleSession {
  const size = sizeForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, size, shuffleDepthForLevel(level));
  return baseSession('level', seed, size, null, level, puzzle.tiles);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): SlidingPuzzleSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_DEPTH);
  return baseSession('daily', seed, DAILY_SIZE, dateString, null, puzzle.tiles);
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: SlidingPuzzleSession): SlidingPuzzleSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(
  data: Omit<SlidingPuzzleSession, 'history' | 'status'>,
): SlidingPuzzleSession {
  return {
    ...data,
    history: [],
    status: isSolved(data.tiles, data.size) ? 'solved' : 'playing',
  };
}

/**
 * Slides the tapped tile — and every tile between it and the blank — one step
 * over (§3). Returns null when the tap does nothing: a tile sharing neither the
 * blank's row nor its column, the blank itself, or a game already solved.
 */
export function moveTile(
  session: SlidingPuzzleSession,
  index: number,
): SlidingPuzzleSession | null {
  if (session.status !== 'playing') return null;
  const result = applyMove(session.tiles, session.size, index);
  if (result === null) return null;

  const history = [...session.history, { tiles: session.tiles, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return {
    ...session,
    tiles: result.tiles,
    history,
    moveCount: session.moveCount + result.moved,
    status: isSolved(result.tiles, session.size) ? 'solved' : 'playing',
  };
}

export function canUndo(session: SlidingPuzzleSession): boolean {
  return session.history.length > 0;
}

/**
 * Takes back one move — board and move count together. A multi-tile slide is
 * undone whole, because it was one move (§8).
 */
export function undo(session: SlidingPuzzleSession): SlidingPuzzleSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    tiles: previous.tiles,
    moveCount: previous.moveCount,
    history: session.history.slice(0, -1),
    status: isSolved(previous.tiles, session.size) ? 'solved' : 'playing',
  };
}
