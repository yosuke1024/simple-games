/**
 * Pure statistics transitions (kept out of React so they can be tested).
 * Per difficulty: games played, games won, fastest win, total play time — plus
 * the days the daily was cleared (docs/MINESWEEPER_RULES.md §9).
 *
 * Win rate is shown because it is a fact about how the player plays, not a
 * verdict on them, and because §4 makes it a fact worth having: on a board that
 * cannot be lost to luck, a loss is information.
 *
 * There is no streak anywhere here, and none can be derived from what is kept:
 * a set of dates is not a chain (§8, docs/PRODUCT_PRINCIPLES.md).
 */
import type { Difficulty, MinesweeperSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (a new board or a retry, never a resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, difficulty: Difficulty, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[difficulty].totalPlaySeconds += seconds;
  return next;
}

export interface WinOutcome {
  readonly stats: Stats;
  /** True when this run beat what the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat after this run. */
  readonly bestSeconds: number;
}

/**
 * Registers a win: the count, the fastest time, and — for a daily — the date.
 *
 * Play time is deliberately not touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a win is booked on top of whatever has
 * already been counted, so the same seconds cannot land in the total twice.
 */
export function applyWin(stats: Stats, session: MinesweeperSession): WinOutcome {
  const next = clone(stats);
  const seconds = session.elapsedSeconds;
  const bucket = next[session.difficulty];

  bucket.won += 1;
  const beatsDifficulty = bucket.bestSeconds === null || seconds < bucket.bestSeconds;
  if (beatsDifficulty) bucket.bestSeconds = seconds;

  if (session.mode === 'daily' && session.dailyDate !== null) {
    const previous = next.dailyTimes[session.dailyDate];
    const isNewBest = previous === undefined || seconds < previous;
    if (isNewBest) next.dailyTimes[session.dailyDate] = seconds;
    return {
      stats: next,
      isNewBest,
      bestSeconds: next.dailyTimes[session.dailyDate] ?? seconds,
    };
  }

  return { stats: next, isNewBest: beatsDifficulty, bestSeconds: bucket.bestSeconds ?? seconds };
}

/**
 * The record this run is measured against — the difficulty's or the day's
 * fastest win before the run is booked — or null when there is none yet (§9).
 * Read before `applyWin`, which is what moves the record.
 */
export function previousBestFor(stats: Stats, session: MinesweeperSession): number | null {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return stats.dailyTimes[session.dailyDate] ?? null;
  }
  return stats[session.difficulty].bestSeconds;
}

/**
 * Wins over games played, 0..1, or null before the first game. A fact, shown
 * plainly (§9) — with no target attached to it.
 */
export function winRate(stats: Stats, difficulty: Difficulty): number | null {
  const bucket = stats[difficulty];
  return bucket.played === 0 ? null : bucket.won / bucket.played;
}

/** How many days the daily has been cleared — a count, never a run (§9). */
export const dailiesCleared = (stats: Stats): number => Object.keys(stats.dailyTimes).length;
