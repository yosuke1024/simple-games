/**
 * TakuzuSession — a pure, immutable snapshot of one puzzle: the solution, the
 * givens, what the player has written, and the counters kept for the result
 * screen.
 *
 * There is deliberately no undo and no history to hold one (§8): every cell
 * cycles empty → 0 → 1 → empty under the same tap, so every move already is
 * its own undo. The help this game offers is the hint (§8), exposed here as
 * `hintFor`.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§7).
 */
import { DAILY_GIVENS_RATIO, DAILY_SIZE, dailySeed } from './daily';
import {
  cycleCell,
  emptyMarks,
  findViolations,
  isSolved,
  mergeBoard,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { givensRatioForLevel, levelSeed, sizeForLevel } from './levels';
import { findHint, type Hint } from './solver';
import type { Cell, GameMode, GameStatus, Mark, Size } from './types';

export interface TakuzuSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  readonly solution: readonly Cell[];
  /** The fixed cells (§1). EMPTY wherever the player has to work it out. */
  readonly givens: readonly Mark[];
  /** What the player has written. Always EMPTY where a given sits (§11). */
  readonly marks: readonly Mark[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/** The board as it reads on screen — the givens with the player's digits over. */
export function boardOf(session: TakuzuSession): Mark[] {
  return mergeBoard(session.givens, session.marks);
}

/** What is currently broken, for the always-on violation display (§9). */
export function violationsOf(session: TakuzuSession): Violations {
  return findViolations(boardOf(session), session.size);
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  dailyDate: string | null,
  level: number | null,
  solution: readonly Cell[],
  givens: readonly Mark[],
): TakuzuSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    solution,
    givens,
    marks: emptyMarks(size),
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level (§7). */
export function createLevelSession(level: number): TakuzuSession {
  const size = sizeForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, size, givensRatioForLevel(level));
  return baseSession('level', seed, size, null, level, puzzle.solution, puzzle.givens);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§7). */
export function createDailySession(dateString: string): TakuzuSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_GIVENS_RATIO);
  return baseSession('daily', seed, DAILY_SIZE, dateString, null, puzzle.solution, puzzle.givens);
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: TakuzuSession): TakuzuSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 */
export function restoreSession(data: Omit<TakuzuSession, 'status'>): TakuzuSession {
  const board = mergeBoard(data.givens, data.marks);
  return { ...data, status: isSolved(board, data.size) ? 'solved' : 'playing' };
}

/**
 * One tap: empty → 0 → 1 → empty (§4). Returns null when nothing changes — an
 * index out of range, a given, or a puzzle already solved.
 *
 * Refusing every move once the status is 'solved' is what makes the transition
 * into it happen exactly once: there is no path from solved back to playing,
 * so the caller can book the completion on the edge and never again.
 */
export function doTap(session: TakuzuSession, index: number): TakuzuSession | null {
  if (session.status !== 'playing') return null;
  const marks = cycleCell(session.givens, session.marks, index);
  if (marks === null) return null;
  const board = mergeBoard(session.givens, marks);
  return {
    ...session,
    marks,
    status: isSolved(board, session.size) ? 'solved' : 'playing',
  };
}

/**
 * The teaching hint of §8 — the next cell the three techniques settle, or the
 * line the player's own digits have already broken. Free and unlimited; never
 * a lookup into the solution.
 */
export function hintFor(session: TakuzuSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(boardOf(session), session.size);
}

/** Hints are counted for the result screen, never limited or charged for. */
export function doHintUse(session: TakuzuSession): TakuzuSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(session: TakuzuSession, seconds: number): TakuzuSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
