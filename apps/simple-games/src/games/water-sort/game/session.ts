/**
 * WaterSession — a pure, immutable snapshot of one game in progress: board +
 * undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the move count along with the board (§8): the move count
 * describes the board you are looking at, so putting the board back puts the
 * count back. Pours can dead-end a board (§3), which is exactly why Undo is
 * unlimited and free.
 *
 * There is no clock on screen (§4); elapsed seconds are carried here for the
 * clear screen and the statistics only.
 */
import { DAILY_COLORS, DAILY_MIX, dailySeed } from './daily';
import { applyPour, isSolved } from './engine';
import { generatePuzzle } from './generator';
import { colorsForLevel, levelSeed, mixForLevel } from './levels';
import type { GameMode, GameStatus, Tubes } from './types';

/** Practically unlimited undo; a real game never comes close (§8). */
export const UNDO_HISTORY_LIMIT = 2000;

/** One step back: the board and the move count that went with it. */
export interface HistoryEntry {
  readonly tubes: Tubes;
  readonly moveCount: number;
}

export interface WaterSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly colors: number;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..999 for level mode, null for daily. */
  readonly level: number | null;
  readonly tubes: Tubes;
  /** Board snapshots before each pour, oldest first. */
  readonly history: readonly HistoryEntry[];
  readonly status: GameStatus;
  /** Pours so far — one move per pour, whatever it carried (§4). */
  readonly moveCount: number;
  /** Hints asked and answered — a fact for the clear screen, never a cost. */
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  colors: number,
  dailyDate: string | null,
  level: number | null,
  tubes: Tubes,
): WaterSession {
  return {
    mode,
    seed,
    colors,
    dailyDate,
    level,
    tubes,
    history: [],
    status: isSolved(tubes) ? 'solved' : 'playing',
    moveCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level. */
export function createLevelSession(level: number): WaterSession {
  const colors = colorsForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, colors, mixForLevel(level));
  return baseSession('level', seed, colors, null, level, puzzle.tubes);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): WaterSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_COLORS, DAILY_MIX);
  return baseSession('daily', seed, DAILY_COLORS, dateString, null, puzzle.tubes);
}

/** Rebuilds the same board from scratch (Restart). */
export function restartSession(session: WaterSession): WaterSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(data: Omit<WaterSession, 'history' | 'status'>): WaterSession {
  return {
    ...data,
    history: [],
    status: isSolved(data.tubes) ? 'solved' : 'playing',
  };
}

/**
 * Pours one tube into another (§3). Returns null when the pour is illegal —
 * or the game is already over — in which case nothing changes.
 */
export function pour(session: WaterSession, from: number, to: number): WaterSession | null {
  if (session.status !== 'playing') return null;
  const result = applyPour(session.tubes, from, to);
  if (result === null) return null;

  const history = [...session.history, { tubes: session.tubes, moveCount: session.moveCount }];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();

  return {
    ...session,
    tubes: result.tubes,
    history,
    moveCount: session.moveCount + 1,
    status: isSolved(result.tubes) ? 'solved' : 'playing',
  };
}

export function canUndo(session: WaterSession): boolean {
  return session.history.length > 0;
}

/** Takes back one pour — board and move count together (§8). */
export function undo(session: WaterSession): WaterSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    tubes: previous.tubes,
    moveCount: previous.moveCount,
    history: session.history.slice(0, -1),
    status: isSolved(previous.tubes) ? 'solved' : 'playing',
  };
}

/** Books an answered hint (§8). The board itself is untouched. */
export function recordHint(session: WaterSession): WaterSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
