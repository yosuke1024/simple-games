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
import {
  computeClues,
  emptyMarks,
  isSolved,
  setMarks,
  toggleCross,
  togglePaint,
  type Clues,
} from './engine';
import { generatePuzzle } from './generator';
import {
  FREE_TIER_LEVEL,
  fillRateForLevel,
  levelSeed,
  sizeForLevel,
  type FreeTier,
} from './levels';
import { findHint, type Hint } from './solver';
import type { Cell, GameMode, GameStatus, Mark, Size } from './types';

export interface NonogramSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for the daily and for free play. */
  readonly level: number | null;
  /** The tier a free board was drawn at (§6「フリープレイ」), null otherwise. */
  readonly freeTier: FreeTier | null;
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
  freeTier: FreeTier | null,
  solution: readonly Cell[],
  clues: Clues,
): NonogramSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    freeTier,
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
  return baseSession(
    'level',
    levelSeed(level),
    size,
    null,
    level,
    null,
    puzzle.solution,
    puzzle.clues,
  );
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§6). */
export function createDailySession(dateString: string): NonogramSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_FILL_RATE);
  return baseSession(
    'daily',
    seed,
    DAILY_SIZE,
    dateString,
    null,
    null,
    puzzle.solution,
    puzzle.clues,
  );
}

/**
 * A token that makes one free board's seed its own (§6「フリープレイ」). Free
 * play has no level number and no date to seed from, so a new game gets a
 * new board — while the seed still pins that board down completely (§5),
 * which is what makes "retry the same board" exact and the saved game
 * restorable.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (token: string): string => `nono-free-${token}`;

/**
 * A fresh free board at a chosen tier — new unless a seed pins an old one.
 * The tier is a representative level's size and fill rate, nothing more.
 */
export function createFreeSession(
  tier: FreeTier,
  seed: string = freeSeed(newSeedToken()),
): NonogramSession {
  const level = FREE_TIER_LEVEL[tier];
  const size = sizeForLevel(level);
  const puzzle = generatePuzzle(seed, size, fillRateForLevel(level));
  return baseSession('free', seed, size, null, null, tier, puzzle.solution, puzzle.clues);
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: NonogramSession): NonogramSession {
  if (session.mode === 'level' && session.level !== null) return createLevelSession(session.level);
  if (session.mode === 'free' && session.freeTier !== null) {
    return createFreeSession(session.freeTier, session.seed);
  }
  return createDailySession(session.dailyDate ?? '');
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
 * Set a stretch of cells to one mark — a drag stroke (§3). Same refusals as
 * above, plus: null when every listed cell already reads that way.
 *
 * The stroke decides its target once, when it starts, and every cell it
 * crosses is written to that target rather than toggled. That is what lets a
 * finger wander back over its own path without unpicking it.
 */
export function markCells(
  session: NonogramSession,
  indices: readonly number[],
  mark: Mark,
): NonogramSession | null {
  if (session.status !== 'playing') return null;
  const marks = setMarks(session.marks, indices, mark);
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
