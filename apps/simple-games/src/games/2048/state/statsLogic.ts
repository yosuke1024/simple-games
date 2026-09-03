/**
 * Pure statistics transitions (kept out of React for testing). Five numbers,
 * no streak: the record is what you have done, not how many days in a row you
 * did it (docs/GAME_2048_RULES.md §9).
 *
 * `bestScore` and `bestTile` are kept separately and neither is derived from
 * the other. A patient game can set the tile record while a scrappy one sets
 * the score record, and collapsing them into a single number would quietly
 * tell the player which of the two the game wants — it wants neither (§7).
 */
import { largestTile, type Game2048Session } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (a new board, not a resume). */
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
 * The record this run is measured against, or null while there is none — a
 * best of 0 is no record yet (§9). Read before `applyRunEnd`, which is what
 * moves it.
 */
export function previousBestScore(stats: Stats): number | null {
  return stats.bestScore > 0 ? stats.bestScore : null;
}

export interface RunOutcome {
  readonly stats: Stats;
  /** True when this run scored higher than anything before it. */
  readonly isNewBestScore: boolean;
}

/**
 * Books a finished run: both records, and the reach if it happened (§9).
 *
 * Called once per run, whether the board ran out of moves or the player
 * replaced it — a run that happened has to count either way, or the statistics
 * would report a best score the player knows they beat.
 */
export function applyRunEnd(stats: Stats, session: Game2048Session): RunOutcome {
  const next = clone(stats);
  const tile = largestTile(session.board);

  if (session.score > next.bestScore) next.bestScore = session.score;
  if (tile > next.bestTile) next.bestTile = tile;
  if (session.reached2048) next.reached2048 += 1;

  return { stats: next, isNewBestScore: session.score > stats.bestScore };
}
