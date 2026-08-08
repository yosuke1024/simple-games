/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * opponent and no streak: the record is what you have done, not how many days
 * in a row you did it.
 *
 * Only a match that actually ended books a result. A match replaced by a new
 * one counted as played when it started, and counting it as lost as well would
 * make the statistics a scold.
 *
 * A *hand* is never booked. Hands are the innings of a match, and a match runs
 * to a hundred points; a record of hands won would count the same evening a
 * dozen times over and would not mean what "wins" means on every other shelf.
 * Nor is there a draw to book: the first seat past a hundred takes the match,
 * so exactly one of the two ends it.
 */
import type { Difficulty, MatchStatus } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started match (a new deal, not a resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += seconds;
  return next;
}

/** Books a finished match's result. A match still in progress books nothing. */
export function applyMatchEnd(stats: Stats, difficulty: Difficulty, status: MatchStatus): Stats {
  if (status === 'playing') return stats;
  const next = clone(stats);
  if (status === 'won') next[difficulty].wins += 1;
  else next[difficulty].losses += 1;
  return next;
}
