/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were finished, not a chain
 * (docs/SCHULTE_TABLE_RULES.md §8, §10).
 *
 * One record per board, and it is time. Misses are counted as a running total
 * and never as a "fewest" record — a fewest-misses best is set by tapping
 * slowly, so keeping it would quietly tell the player which of speed and care
 * the game wants (§9).
 */
import { MAX_LEVEL, type SchulteSession, type Size } from '../game';
import { sizeKey, type Progress, type Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started round (new round or retry, not a resume — there is none). */
export function applyGameStart(stats: Stats, size: Size): Stats {
  const next = clone(stats);
  next[sizeKey(size)].played += 1;
  return next;
}

/**
 * Registers a finished round: the count, the best time, and the misses it took.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a finish is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applyCleared(stats: Stats, session: SchulteSession): Stats {
  const next = clone(stats);
  const bucket = next[sizeKey(session.size)];
  bucket.cleared += 1;
  bucket.totalMisses += session.missCount;
  if (bucket.bestSeconds === null || session.elapsedSeconds < bucket.bestSeconds) {
    bucket.bestSeconds = session.elapsedSeconds;
  }
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, size: Size, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[sizeKey(size)].totalPlaySeconds += seconds;
  return next;
}

/**
 * Books the misses of a round the player walked away from.
 *
 * An abandoned round counts as played but never as cleared (§11), and its
 * wrong taps happened all the same — dropping them would make the running
 * total quietly depend on whether people finish.
 */
export function applyAbandonedMisses(stats: Stats, size: Size, misses: number): Stats {
  if (misses <= 0) return stats;
  const next = clone(stats);
  next[sizeKey(size)].totalMisses += misses;
  return next;
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this round beat the board's previous best time. */
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
}

/**
 * Records a finish: unlocks the next level and keeps the better time. Replaying
 * an old level or an old daily can improve the record but never moves the
 * frontier backwards.
 */
export function applyClearToProgress(progress: Progress, session: SchulteSession): ClearOutcome {
  const next: Progress = {
    ...progress,
    bestSeconds: { ...progress.bestSeconds },
    dailySeconds: { ...progress.dailySeconds },
  };
  const seconds = session.elapsedSeconds;

  const record = (map: Record<string, number>, key: string): ClearOutcome => {
    const previous = map[key];
    const isNewBest = previous === undefined || seconds < previous;
    if (isNewBest) map[key] = seconds;
    return { progress: next, isNewBest, bestSeconds: map[key] ?? seconds };
  };

  if (session.mode === 'level' && session.level !== null) {
    const outcome = record(next.bestSeconds, String(session.level));
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    return outcome;
  }

  if (session.dailyDate !== null) {
    return record(next.dailySeconds, session.dailyDate);
  }

  return { progress: next, isNewBest: false, bestSeconds: seconds };
}

/** How many levels have been finished — shown in Statistics. */
export function clearedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestSeconds).length;
}

/** How many daily boards have been finished. A count, never a run of days (§8). */
export function clearedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
