/**
 * Pure statistics transitions (kept out of React for testing). One record
 * for the whole match and no streak: the record is what you have done, not
 * how many days in a row you did it (docs/YACHT_RULES.md §7).
 *
 * Only a sheet that was filled books a score and a result. A match replaced
 * by a new one counted as played when it started; its half-filled sheet is
 * not a result.
 */
import type { Stats } from '../storage/schemas';
import type { Outcome } from '../game';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started match (a new sheet, not a resume). */
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

/**
 * Books a filled sheet's total and its result against the CPU (§7): the
 * count, the sum, the best, and one of `wins` / `losses` / `draws`. `total`
 * is always the player's total — the one the average and the best are about.
 */
export function applyGameEnd(stats: Stats, total: number, outcome: Outcome): Stats {
  const next = clone(stats);
  next.completed += 1;
  next.totalScore += total;
  next.bestScore = next.bestScore === null ? total : Math.max(next.bestScore, total);
  if (outcome === 'won') next.wins += 1;
  else if (outcome === 'lost') next.losses += 1;
  else next.draws += 1;
  return next;
}

/** The average finished sheet, rounded — null before the first one (§7). */
export function averageScore(stats: Stats): number | null {
  return stats.completed > 0 ? Math.round(stats.totalScore / stats.completed) : null;
}
