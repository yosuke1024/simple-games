/**
 * Pure statistics transitions (kept out of React for testing). One record for
 * the whole game, and no streak: the record is what you have done, not how
 * many days in a row you did it (docs/SCOPA_RULES.md §8).
 *
 * A match counts as played when it starts. Only a match that actually ended
 * books a result — one replaced by a new match is not a loss, or the
 * statistics would become a scold. A *deal* is never booked: deals are the
 * innings of a match, and counting them would not mean what "wins" means on
 * every other shelf. There is no draw to book either: eleven or more and
 * ahead is always one side (§3.4).
 */
import type { MatchStatus } from '../game';
import type { Stats } from '../storage/schemas';

/** Registers a started match (a new deal, not a resume). */
export function applyGameStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

/** Books a finished match's result. A match still in progress books nothing. */
export function applyMatchEnd(stats: Stats, status: MatchStatus): Stats {
  if (status === 'playing') return stats;
  return status === 'won'
    ? { ...stats, wins: stats.wins + 1 }
    : { ...stats, losses: stats.losses + 1 };
}
