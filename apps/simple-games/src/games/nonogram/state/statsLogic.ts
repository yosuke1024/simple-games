/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were solved, not a chain
 * (docs/NONOGRAM_RULES.md §6, §9).
 *
 * The only best kept is time. There is no move count worth recording — marks
 * toggle freely (§3), so counting them would measure hesitation, not skill.
 */
import { MAX_LEVEL, type NonogramSession, type Size } from '../game';
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
export function applySolveToProgress(progress: Progress, session: NonogramSession): ClearOutcome {
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

  return { progress: next, isNewBestTime: false, bestSeconds: seconds };
}

/** How many levels have been solved — shown on the level list. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestSeconds).length;
}

/** How many daily boards have been solved. A count, never a run of days (§6). */
export function solvedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
