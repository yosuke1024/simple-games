/**
 * NonogramSession — a pure, immutable snapshot of one puzzle: solution, clues,
 * the player's marks, and the counters kept for the result screen.
 *
 * There is deliberately no undo and no history to hold one (§7): paint and
 * cross both toggle off with the same tap that put them down, so every move
 * already is its own undo. The help this game offers is the hint (§7),
 * exposed here as `hintFor`.
 *
 * Elapsed seconds are carried for the result screen and the statistics only —
 * never shown while the game is running (§8).
 */
import { DAILY_FILL_RATE, DAILY_SIZE, dailySeed } from './daily';
import { computeClues, emptyMarks, isSolved, toggleCross, togglePaint, type Clues } from './engine';
import { generatePuzzle } from './generator';
import { fillRateForLevel, levelSeed, sizeForLevel } from './levels';
import { findHint, type Hint } from './solver';
import type { Cell, GameMode, GameStatus, Mark, Size } from './types';

export interface NonogramSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..999 for level mode, null for daily. */
  readonly level: number | null;
  readonly solution: readonly Cell[];
  readonly clues: Clues;
  readonly marks: readonly Mark[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  dailyDate: string | null,
  level: number | null,
  solution: readonly Cell[],
  clues: Clues,
): NonogramSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    solution,
    clues,
    marks: emptyMarks(size),
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level (§6). */
export function createLevelSession(level: number): NonogramSession {
  const size = sizeForLevel(level);
  const puzzle = generatePuzzle(levelSeed(level), size, fillRateForLevel(level));
  return baseSession('level', levelSeed(level), size, null, level, puzzle.solution, puzzle.clues);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§6). */
export function createDailySession(dateString: string): NonogramSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_FILL_RATE);
  return baseSession('daily', seed, DAILY_SIZE, dateString, null, puzzle.solution, puzzle.clues);
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: NonogramSession): NonogramSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/** Restores a session from persisted state; the win is re-derived, not trusted. */
export function restoreSession(data: Omit<NonogramSession, 'clues' | 'status'>): NonogramSession {
  const clues = computeClues(data.solution, data.size);
  return {
    ...data,
    clues,
    status: isSolved(data.marks, clues, data.size) ? 'solved' : 'playing',
  };
}

function withMarks(session: NonogramSession, marks: readonly Mark[]): NonogramSession {
  return {
    ...session,
    marks,
    status: isSolved(marks, session.clues, session.size) ? 'solved' : 'playing',
  };
}

/**
 * Paint / unpaint one cell (§3). Returns null when nothing changes — an index
 * out of range or a puzzle already solved.
 */
export function paintCell(session: NonogramSession, index: number): NonogramSession | null {
  if (session.status !== 'playing') return null;
  const marks = togglePaint(session.marks, index);
  return marks === null ? null : withMarks(session, marks);
}

/** Cross / uncross one cell (§3). Same refusals as above. */
export function crossCell(session: NonogramSession, index: number): NonogramSession | null {
  if (session.status !== 'playing') return null;
  const marks = toggleCross(session.marks, index);
  return marks === null ? null : withMarks(session, marks);
}

/**
 * The teaching hint of §7 — one newly decided cell, or the line the player's
 * marks have made impossible. Free and unlimited; never a solution lookup.
 */
export function hintFor(session: NonogramSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.marks, session.clues.rows, session.clues.cols, session.size);
}

/** Hints are counted for the result screen, never limited or charged for. */
export function countHintUse(session: NonogramSession): NonogramSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
