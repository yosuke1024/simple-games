/**
 * Pure statistics transitions, kept out of React so they can be tested
 * (docs/MAKE_THE_TARGET_RULES.md §9). Per difficulty: problems played,
 * problems solved, the fastest clear and the play time. The daily keeps its
 * own play count and play time, and the days it was cleared (provisional —
 * Bridges' shape, §9, §17). The total across every mode is a sum read off
 * these, never a number of its own.
 *
 * Two rules live here and nowhere else (§9):
 * - **A retry of a problem already solved does not move the records.** In
 *   Free Play that is a session whose `repeat` is true: it is played, solved
 *   and timed like any other, but its time is never compared with nor written
 *   into `bestSeconds`. The daily does not use `repeat`: a clear on a day that
 *   already has its entry in `dailyTimes` leaves that entry as it is.
 * - **A daily is booked under the problem's date** (`dailyDate`), not the day
 *   it happened to be finished on.
 *
 * There is no streak anywhere here, and none can be derived from what is
 * kept: a set of dates is not a chain (§8, docs/PRODUCT_PRINCIPLES.md).
 */
import { DIFFICULTIES, type Difficulty, type GameMode, type MakeTheTargetSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Which bucket a game's plays are booked into: its difficulty, or the daily's own. */
export type StatsBucket = Difficulty | 'daily';

export const bucketOf = (session: { mode: GameMode; difficulty: Difficulty }): StatsBucket =>
  session.mode === 'daily' ? 'daily' : session.difficulty;

/** Registers a started game: a new problem or a retry, never a resume (§9). */
export function applyGameStart(stats: Stats, bucket: StatsBucket): Stats {
  const next = clone(stats);
  next[bucket].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, bucket: StatsBucket, seconds: number): Stats {
  if (!(seconds > 0)) return stats;
  const next = clone(stats);
  next[bucket].totalPlaySeconds += seconds;
  return next;
}

/**
 * How a clear stands against the record it is compared with (§9) — the
 * difficulty's `bestSeconds` in Free Play, the day's entry in a daily.
 */
export interface RecordComparison {
  /** The record before this clear, or null on a first clear. */
  readonly previousSeconds: number | null;
  /** True when this clear set the record: a first clear, or strictly faster. */
  readonly isNewBest: boolean;
  /** The record after this clear. */
  readonly bestSeconds: number;
}

export interface SolveOutcome {
  readonly stats: Stats;
  /**
   * Null for a clear that is not compared with any record: a retry of a
   * solved problem in Free Play, or a daily cleared again on its day (§9).
   */
  readonly comparison: RecordComparison | null;
}

/**
 * Registers a clear (§9). Play time is deliberately not touched here; it
 * accumulates through `applyPlayTime` as the clock runs, so the same seconds
 * cannot land twice.
 */
export function applySolved(stats: Stats, session: MakeTheTargetSession): SolveOutcome {
  const next = clone(stats);
  const seconds = session.elapsedSeconds;

  if (session.mode === 'daily') {
    const date = session.dailyDate;
    if (date === null || next.dailyTimes[date] !== undefined) {
      return { stats: next, comparison: null };
    }
    next.dailyTimes[date] = seconds;
    return {
      stats: next,
      comparison: { previousSeconds: null, isNewBest: true, bestSeconds: seconds },
    };
  }

  const bucket = next[session.difficulty];
  bucket.solved += 1;
  if (session.repeat) return { stats: next, comparison: null };
  const previousSeconds = bucket.bestSeconds;
  // Strictly faster only: a tie is not a new record (§9).
  const isNewBest = previousSeconds === null || seconds < previousSeconds;
  if (isNewBest) bucket.bestSeconds = seconds;
  return {
    stats: next,
    comparison: { previousSeconds, isNewBest, bestSeconds: bucket.bestSeconds ?? seconds },
  };
}

/** How many days the daily has been cleared — a count, never a run (§9). */
export const dailiesCleared = (stats: Stats): number => Object.keys(stats.dailyTimes).length;

/** Play time across every mode (§9): a sum of what the buckets hold. */
export const totalPlaySeconds = (stats: Stats): number =>
  DIFFICULTIES.reduce((sum, difficulty) => sum + stats[difficulty].totalPlaySeconds, 0) +
  stats.daily.totalPlaySeconds;
