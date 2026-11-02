/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * opponent and no streak: the record is what you have done, not how many days
 * in a row you did it (docs/BACKGAMMON_RULES.md §8).
 *
 * Only a match that actually ended books a result. A match replaced by a new
 * one counted as played when it started, and a match abandoned as no result
 * (§3) books nothing either — counting either as lost would make the
 * statistics a scold.
 */
import type { Difficulty, GameStatus } from '../game/types';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView and
 * low-spec devices are a release requirement; these records are small pure
 * data, so the JSON round-trip covers every engine we reach.
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

/** Books a decided match's result (§8). Anything else books nothing. */
export function applyMatchEnd(stats: Stats, difficulty: Difficulty, status: GameStatus): Stats {
  if (status !== 'won' && status !== 'lost') return stats;
  const next = clone(stats);
  if (status === 'won') next[difficulty].wins += 1;
  else next[difficulty].losses += 1;
  return next;
}
