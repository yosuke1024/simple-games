/**
 * The statistics transitions, kept out of React for testing
 * (docs/BOUNCE_UP_RULES.md §5). Thin on purpose: the booking arithmetic is
 * game/score.ts's `bookRun`; this module only carries it over the persisted
 * record, so the provider never touches a field by hand.
 *
 * Counts and sums only — no streak, no per-run history.
 */
import { bookRun } from '../game/score';
import type { PlatformWidth } from '../game/types';
import type { Stats } from '../storage/schemas';

/** A run that starts moving counts once (ready → running, §5). */
export function applyRunStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** What one booking hands the record: whole seconds not yet booked, and the run's score now. */
export interface Booking {
  readonly width: PlatformWidth;
  /** Whole seconds of running not booked yet (≥ 0). */
  readonly seconds: number;
  /** The points of this run already in `total`. */
  readonly bookedScore: number;
  /** The run's score now (it never drops — §4). */
  readonly score: number;
}

/**
 * The one booking (§5「計上は 1 本」): the seconds and the score's growth since
 * the last booking go into the record, the best is raised by max. Returns the
 * same record when nothing changed, so the caller can skip the write, and the
 * new booked mark either way. Booking twice adds nothing.
 */
export function applyBooking(stats: Stats, booking: Booking): { stats: Stats; booked: number } {
  const { add, booked } = bookRun(booking.bookedScore, booking.score);
  const seconds =
    Number.isSafeInteger(booking.seconds) && booking.seconds > 0 ? booking.seconds : 0;
  const width = booking.width;
  const best = Math.max(stats.best[width], booked);
  if (add === 0 && seconds === 0 && best === stats.best[width]) return { stats, booked };
  return {
    booked,
    stats: {
      ...stats,
      best: { ...stats.best, [width]: best },
      total: { ...stats.total, [width]: stats.total[width] + add },
      totalPlaySeconds: stats.totalPlaySeconds + seconds,
    },
  };
}
