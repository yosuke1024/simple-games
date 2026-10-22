/**
 * Pure statistics transitions over the stored record (kept out of React so
 * they can be tested on their own). The meaning — what counts, when, and per
 * which gem count — is game/records.ts's (docs/GEM_SWAP_RULES.md §5); this
 * module only carries the stored record's version through it and adds the
 * play time the state layer books.
 */
import { bestFor, countRoundStart, countsTowardRecord, recordRoundEnd, type Round } from '../game';
import type { Stats } from '../storage/schemas';

/** A round started — a new board or the same board again (§5). Never a resume or an Undo. */
export const applyRoundStart = (stats: Stats): Stats => ({ ...stats, ...countRoundStart(stats) });

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

export interface RoundEndBooking {
  readonly stats: Stats;
  /** The round counts toward the best: it ended by 30 swaps or stuck (§5). */
  readonly counted: boolean;
  /** The best for this gem count before the round, or null while there was none. */
  readonly previousBest: number | null;
  /** The best for this gem count after the round (0 = still none). */
  readonly best: number;
  /** The round set a new best (a first best included). */
  readonly isNewBest: boolean;
}

/** Books a round that just flipped to 'over' — once (§5). */
export function applyRoundEnd(stats: Stats, round: Round): RoundEndBooking {
  const before = bestFor(stats, round.colors);
  const next: Stats = { ...stats, ...recordRoundEnd(stats, round) };
  const best = bestFor(next, round.colors);
  return {
    stats: next,
    counted: countsTowardRecord(round),
    previousBest: before > 0 ? before : null,
    best,
    isNewBest: best > before,
  };
}
