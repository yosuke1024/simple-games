/**
 * Pure statistics transitions (kept out of React for testing). A record per
 * board size and no streak: the record is what you have done, not how many
 * days in a row you did it (docs/DOTS_AND_BOXES_RULES.md §7).
 *
 * Only a match that actually ended books a result. A match replaced by a new
 * one counted as played when it started, and counting it as lost as well
 * would make the statistics a scold (§7).
 */
import type { BoardSize, GameStatus } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started match (a new board, not a resume). */
export function applyGameStart(stats: Stats, size: BoardSize): Stats {
  const next = clone(stats);
  next[size].played += 1;
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
export function applyMatchEnd(stats: Stats, size: BoardSize, status: GameStatus): Stats {
  if (status === 'playing') return stats;
  const next = clone(stats);
  if (status === 'won') next[size].wins += 1;
  else if (status === 'lost') next[size].losses += 1;
  else next[size].draws += 1;
  return next;
}
