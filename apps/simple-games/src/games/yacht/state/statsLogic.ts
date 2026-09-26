/**
 * Pure statistics transitions (kept out of React for testing). One record
 * for the whole game and no streak: the record is what you have done, not
 * how many days in a row you did it (docs/YACHT_RULES.md §6).
 *
 * Only a sheet that was filled books a score. A game replaced by a new one
 * counted as played when it started; its half-filled sheet is not a result.
 */
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (a new sheet, not a resume). */
export function applyGameStart(stats: Stats): Stats {
  const next = clone(stats);
  next.played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += seconds;
  return next;
}

/** Books a filled sheet's total (§6): the count, the sum, and the best. */
export function applyGameEnd(stats: Stats, total: number): Stats {
  const next = clone(stats);
  next.completed += 1;
  next.totalScore += total;
  next.bestScore = next.bestScore === null ? total : Math.max(next.bestScore, total);
  return next;
}

/** The average finished sheet, rounded — null before the first one (§6). */
export function averageScore(stats: Stats): number | null {
  return stats.completed > 0 ? Math.round(stats.totalScore / stats.completed) : null;
}
