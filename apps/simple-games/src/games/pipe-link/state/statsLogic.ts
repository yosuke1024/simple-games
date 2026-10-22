/**
 * Pure statistics transitions (kept out of React so they can be tested).
 * Per difficulty: boards played, boards solved, fastest clear, total play
 * time. The daily keeps its own play count and play time, and the days it was
 * cleared (docs/PIPE_LINK_RULES.md §8). The total across every mode is a sum
 * read off these, never a number of its own. Turns are never counted (§3).
 *
 * There is no streak anywhere here, and none can be derived from what is
 * kept: a set of dates is not a chain (§8, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Difficulty, GameMode, PipeLinkSession } from '../game';
import { MAX_DAILY_ENTRIES, type Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and the floor is Chromium 88; these records are small pure
 * data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Which bucket a game's plays are booked into: its difficulty, or the daily's own. */
export type StatsBucket = Difficulty | 'daily';

export const bucketOf = (session: { mode: GameMode; difficulty: Difficulty }): StatsBucket =>
  session.mode === 'daily' ? 'daily' : session.difficulty;

/** Registers a started game (a new board or a Restart, never a resume — §8). */
export function applyGameStart(stats: Stats, bucket: StatsBucket): Stats {
  const next = clone(stats);
  next[bucket].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, bucket: StatsBucket, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[bucket].totalPlaySeconds += seconds;
  return next;
}

export interface SolveOutcome {
  readonly stats: Stats;
  /** True when this run beat what the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat after this run. */
  readonly bestSeconds: number;
}

/**
 * Registers a clear: for Free Play the count and the fastest time; for a daily
 * the day and its fastest time. Play time is deliberately not touched here; it
 * accumulates through `applyPlayTime` as the clock runs, so the same seconds
 * cannot land twice.
 */
export function applySolved(stats: Stats, session: PipeLinkSession): SolveOutcome {
  const next = clone(stats);
  const seconds = session.elapsedSeconds;

  if (session.mode === 'daily' && session.dailyDate !== null) {
    const previous = next.dailyTimes[session.dailyDate];
    const isNewBest = previous === undefined || seconds < previous;
    // The map is bounded (§8): a day beyond the cap is not recorded, rather
    // than an older day being thrown away to make room.
    const room = previous !== undefined || Object.keys(next.dailyTimes).length < MAX_DAILY_ENTRIES;
    if (isNewBest && room) next.dailyTimes[session.dailyDate] = seconds;
    return {
      stats: next,
      isNewBest,
      bestSeconds: next.dailyTimes[session.dailyDate] ?? seconds,
    };
  }

  const bucket = next[session.difficulty];
  bucket.solved += 1;
  const isNewBest = bucket.bestSeconds === null || seconds < bucket.bestSeconds;
  if (isNewBest) bucket.bestSeconds = seconds;
  return { stats: next, isNewBest, bestSeconds: bucket.bestSeconds ?? seconds };
}

/**
 * The record this run is measured against — the difficulty's or the day's
 * fastest clear before the run is booked — or null when there is none yet.
 * Read before `applySolved`, which is what moves the record.
 */
export function previousBestFor(stats: Stats, session: PipeLinkSession): number | null {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return stats.dailyTimes[session.dailyDate] ?? null;
  }
  return stats[session.difficulty].bestSeconds;
}

/** How many days the daily has been cleared — a count, never a run (§8). */
export const dailiesCleared = (stats: Stats): number => Object.keys(stats.dailyTimes).length;

/** Play time across every mode (§8): a sum of what the buckets hold. */
export const totalPlaySeconds = (stats: Stats): number =>
  stats.easy.totalPlaySeconds +
  stats.medium.totalPlaySeconds +
  stats.hard.totalPlaySeconds +
  stats.daily.totalPlaySeconds;
