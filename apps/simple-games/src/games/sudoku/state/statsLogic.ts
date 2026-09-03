/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were solved, not a chain
 * (docs/SUDOKU_RULES.md §10, §12).
 */
import { MAX_LEVEL, type Difficulty, type SudokuSession } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/**
 * Registers a solve: the count, the best time, and the average's input.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a solve is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applySolved(stats: Stats, difficulty: Difficulty, seconds: number): Stats {
  const next = clone(stats);
  const bucket = next[difficulty];
  bucket.solved += 1;
  bucket.totalSolvedSeconds += seconds;
  if (bucket.bestSeconds === null || seconds < bucket.bestSeconds) {
    bucket.bestSeconds = seconds;
  }
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, difficulty: Difficulty, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[difficulty].totalPlaySeconds += seconds;
  return next;
}

/** The average solve time, or null before the first solve. */
export function averageSolveSeconds(stats: Stats, difficulty: Difficulty): number | null {
  const bucket = stats[difficulty];
  return bucket.solved === 0 ? null : Math.round(bucket.totalSolvedSeconds / bucket.solved);
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this run beat the board's previous best time. */
  readonly isNewBest: boolean;
  /** The best time for this board after the run. */
  readonly bestSeconds: number;
}

/**
 * Records a solve: unlocks the next level, and keeps the faster time for the
 * board. Replaying an old level or an old daily can improve its time but never
 * moves the frontier backwards.
 */
export function applySolveToProgress(progress: Progress, session: SudokuSession): ClearOutcome {
  const next: Progress = {
    ...progress,
    bestTimes: { ...progress.bestTimes },
    dailyTimes: { ...progress.dailyTimes },
  };
  const seconds = session.elapsedSeconds;

  if (session.mode === 'level' && session.level !== null) {
    const key = String(session.level);
    const previous = next.bestTimes[key];
    const isNewBest = previous === undefined || seconds < previous;
    if (isNewBest) next.bestTimes[key] = seconds;
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    return { progress: next, isNewBest, bestSeconds: next.bestTimes[key] ?? seconds };
  }

  if (session.dailyDate !== null) {
    const previous = next.dailyTimes[session.dailyDate];
    const isNewBest = previous === undefined || seconds < previous;
    if (isNewBest) next.dailyTimes[session.dailyDate] = seconds;
    return {
      progress: next,
      isNewBest,
      bestSeconds: next.dailyTimes[session.dailyDate] ?? seconds,
    };
  }

  return { progress: next, isNewBest: false, bestSeconds: seconds };
}

/**
 * The record this run is measured against — the board's best before the run
 * is booked — or null when there is none yet (§12). Read before
 * `applySolveToProgress`, which is what moves the record.
 */
export function previousBestFor(progress: Progress, session: SudokuSession): number | null {
  if (session.mode === 'level' && session.level !== null) {
    return progress.bestTimes[String(session.level)] ?? null;
  }
  if (session.dailyDate !== null) return progress.dailyTimes[session.dailyDate] ?? null;
  return null;
}

/** How many levels have been solved — shown on the level list. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestTimes).length;
}
