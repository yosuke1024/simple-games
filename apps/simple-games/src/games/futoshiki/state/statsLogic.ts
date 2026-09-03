/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were solved, not a chain
 * (docs/FUTOSHIKI_RULES.md §9, §10).
 *
 * Everything is keyed per board size, because the size is what a run's numbers
 * mean — a 7×7 and a 4×4 share no scale. Not per tier: a player picks a level
 * number, never a tier, so a table cut that way would be cut along an axis
 * nobody chooses (§10).
 *
 * Mistakes and hints are not booked here at all. They belong to the run and
 * are shown on the clear screen (§5, §6); adding them up across a lifetime
 * would turn two counters that exist to be forgiven into a score.
 */
import { MAX_LEVEL, type FutoshikiSession, type Size } from '../game';
import { sizeKey, type Progress, type Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, size: Size): Stats {
  const next = clone(stats);
  next[sizeKey(size)].played += 1;
  return next;
}

/**
 * Registers a solve: the count and the size's best time.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a solve is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applySolved(stats: Stats, size: Size, seconds: number): Stats {
  const next = clone(stats);
  const bucket = next[sizeKey(size)];
  bucket.solved += 1;
  if (bucket.bestSeconds === null || seconds < bucket.bestSeconds) bucket.bestSeconds = seconds;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, size: Size, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[sizeKey(size)].totalPlaySeconds += seconds;
  return next;
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this run beat the board's previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestSeconds: number;
}

/**
 * Records a solve: unlocks the next level, and keeps the better time for the
 * board. Replaying an old level or an old daily can improve the record but
 * never moves the frontier backwards.
 */
export function applySolveToProgress(progress: Progress, session: FutoshikiSession): ClearOutcome {
  const next: Progress = {
    ...progress,
    bestSeconds: { ...progress.bestSeconds },
    dailySeconds: { ...progress.dailySeconds },
  };
  const seconds = session.elapsedSeconds;

  const record = (timeMap: Record<string, number>, key: string): ClearOutcome => {
    const previous = timeMap[key];
    const isNewBestTime = previous === undefined || seconds < previous;
    if (isNewBestTime) timeMap[key] = seconds;
    return { progress: next, isNewBestTime, bestSeconds: timeMap[key] ?? seconds };
  };

  if (session.mode === 'level' && session.level !== null) {
    const outcome = record(next.bestSeconds, String(session.level));
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    return outcome;
  }

  if (session.dailyDate !== null) {
    return record(next.dailySeconds, session.dailyDate);
  }

  // A free board (§9) has no level and no date: progress is left as it was.
  return { progress: next, isNewBestTime: false, bestSeconds: seconds };
}

/**
 * The record this run is measured against — the board's best before the run
 * is booked — or null when there is none yet (§10). Read before
 * `applySolveToProgress`, which is what moves the record. A free board has no
 * board to keep one for; its record is the size's, and the caller reads that
 * off the statistics (§9).
 */
export function previousBestFor(progress: Progress, session: FutoshikiSession): number | null {
  if (session.mode === 'level' && session.level !== null) {
    return progress.bestSeconds[String(session.level)] ?? null;
  }
  if (session.dailyDate !== null) return progress.dailySeconds[session.dailyDate] ?? null;
  return null;
}

/** How many levels have been solved — shown on the statistics screen. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestSeconds).length;
}

/** How many daily boards have been solved. A count, never a run of days (§9). */
export function solvedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
