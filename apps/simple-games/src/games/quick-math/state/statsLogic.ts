/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were finished, not a chain
 * (docs/QUICK_MATH_RULES.md §7, §10).
 *
 * One record per board, and it is time. Wrong answers are counted as a running
 * total and never as a "fewest" record — a fewest-mistakes best is set by
 * answering slowly, so keeping it would quietly tell the player which of speed
 * and care the game wants (§4).
 */
import { MAX_LEVEL, trackForLevel, type QuickMathSession, type StatsBucket } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Which bucket a set is counted in (§10). A daily has its own, so a twenty
 * question day never competes with a ten question level for a band's record.
 */
export function bucketFor(session: QuickMathSession): StatsBucket {
  if (session.mode === 'daily' || session.level === null) return 'daily';
  return trackForLevel(session.level);
}

/** Registers a started set (new set or restart, not resume). */
export function applyGameStart(stats: Stats, bucket: StatsBucket): Stats {
  const next = clone(stats);
  next[bucket].played += 1;
  return next;
}

/**
 * Registers a finished set: the count, the best time, and the wrong answers it
 * took.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a finish is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applyCleared(stats: Stats, session: QuickMathSession): Stats {
  const next = clone(stats);
  const bucket = next[bucketFor(session)];
  bucket.cleared += 1;
  bucket.totalMisses += session.missCount;
  if (bucket.bestSeconds === null || session.elapsedSeconds < bucket.bestSeconds) {
    bucket.bestSeconds = session.elapsedSeconds;
  }
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, bucket: StatsBucket, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[bucket].totalPlaySeconds += seconds;
  return next;
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this set beat the board's previous best time. */
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
}

/**
 * Records a finish: unlocks the next level and keeps the better time. Replaying
 * an old level or an old daily can improve the record but never moves the
 * frontier backwards.
 */
export function applyClearToProgress(progress: Progress, session: QuickMathSession): ClearOutcome {
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

/** How many daily sets have been finished. A count, never a run of days (§7). */
export function clearedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
