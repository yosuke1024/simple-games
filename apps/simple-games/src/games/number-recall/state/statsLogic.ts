/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were finished, not a chain
 * (docs/NUMBER_RECALL_RULES.md §9, §11).
 *
 * One record per board, and it is time — the time including the look, because
 * looking is part of the round (§3). Failures are not recorded per level: the
 * layout that was failed is gone, and a "times failed" number against a level
 * would be counted against boards that no longer exist (§8).
 */
import { MAX_LEVEL, type RecallSession, type Size } from '../game';
import { sizeKey, type Progress, type Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started round. A retry is a round of its own (§8). */
export function applyGameStart(stats: Stats, size: Size): Stats {
  const next = clone(stats);
  next[sizeKey(size)].played += 1;
  return next;
}

/**
 * Registers a finished round: the count, the best time, and whether it was
 * done at the first attempt.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a finish is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applyCleared(stats: Stats, session: RecallSession): Stats {
  const next = clone(stats);
  const bucket = next[sizeKey(session.size)];
  bucket.cleared += 1;
  if (session.attempt === 0) bucket.firstTryClears += 1;
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
export function applyClearToProgress(progress: Progress, session: RecallSession): ClearOutcome {
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

/**
 * The record this round is measured against — the level's or the day's best
 * before the round is booked — or null when there is none yet (§11). Read
 * before `applyClearToProgress`, which is what moves the record.
 */
export function previousBestFor(progress: Progress, session: RecallSession): number | null {
  if (session.mode === 'level' && session.level !== null) {
    return progress.bestSeconds[String(session.level)] ?? null;
  }
  if (session.dailyDate !== null) return progress.dailySeconds[session.dailyDate] ?? null;
  return null;
}

/** How many levels have been finished — shown in Statistics. */
export function clearedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestSeconds).length;
}

/** How many daily boards have been finished. A count, never a run of days (§9). */
export function clearedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
