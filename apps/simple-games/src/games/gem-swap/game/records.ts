/**
 * What counts toward the statistics (docs/GEM_SWAP_RULES.md §5, §7), as pure
 * functions so the state layer only calls them at the right moments:
 *
 *   - `countRoundStart` once when a round starts — a new board or the same
 *     board again — never on resume or Undo. `played` is not split by colour
 *     count.
 *   - `recordRoundEnd` once when a round flips to 'over'. Only rounds that
 *     ended by 30 swaps or by being stuck count; a round stopped by the
 *     cascade cap ended on an unsettled board, so its score is not a score
 *     the rules define (§4.4). The best is per colour count.
 *
 * Play time is booked by the state layer (bookedRef) and only carried here.
 */
import type { Round } from './round';
import { CASCADE_STAGE_LIMIT, CELL_COUNT, ROUND_SWAPS, type ColorCount } from './types';

/**
 * The most a round could ever score (§4.4, §5): 30 swaps, each at most 64
 * stages of at most 64 cells. Far above anything play reaches (§14) — it is
 * the bound a stored best is checked against, not a target.
 */
export const MAX_ROUND_SCORE = ROUND_SWAPS * CASCADE_STAGE_LIMIT * CELL_COUNT;

/**
 * The least a counted round can score: a round always starts with a valid
 * swap (§4.1), so one that ends by swaps or stuck made at least one, and a
 * swap clears at least three gems (§1). A stored best of 1 or 2 is corrupt.
 */
export const MIN_COUNTED_SCORE = 3;

export interface GemSwapStats {
  readonly played: number;
  /** Best round score per colour count; 0 = none yet. */
  readonly best5: number;
  readonly best6: number;
  readonly totalPlaySeconds: number;
}

export const emptyStats = (): GemSwapStats => ({
  played: 0,
  best5: 0,
  best6: 0,
  totalPlaySeconds: 0,
});

export const bestFor = (stats: GemSwapStats, colors: ColorCount): number =>
  colors === 5 ? stats.best5 : stats.best6;

export const countRoundStart = (stats: GemSwapStats): GemSwapStats => ({
  ...stats,
  played: stats.played + 1,
});

/** Whether a finished round's score is a record candidate (§5). */
export const countsTowardRecord = (round: Round): boolean =>
  round.status === 'over' && (round.endReason === 'swaps' || round.endReason === 'stuck');

/** The stats after a round ends; unchanged when the round does not count. */
export function recordRoundEnd(stats: GemSwapStats, round: Round): GemSwapStats {
  if (!countsTowardRecord(round)) return stats;
  if (round.score <= bestFor(stats, round.colors)) return stats;
  return round.colors === 5 ? { ...stats, best5: round.score } : { ...stats, best6: round.score };
}
