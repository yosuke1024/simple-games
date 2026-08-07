/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * opponent and no streak: the record is what you have done, not how many days
 * in a row you did it (docs/GOMOKU_RULES.md §7).
 *
 * Only a match that actually ended books a result. A match replaced by a new
 * one counted as played when it started, and counting it as lost as well
 * would make the statistics a scold (§7).
 */
import type { Difficulty, GameStatus } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started match (a new board, not a resume). */
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

/** Books a finished match's result (§7). Playing status books nothing. */
export function applyMatchEnd(stats: Stats, difficulty: Difficulty, status: GameStatus): Stats {
  if (status === 'playing') return stats;
  const next = clone(stats);
  if (status === 'won') next[difficulty].wins += 1;
  else if (status === 'lost') next[difficulty].losses += 1;
  else next[difficulty].draws += 1;
  return next;
}
