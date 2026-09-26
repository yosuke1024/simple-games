/**
 * Pure statistics transitions (kept out of React for testing). One record and
 * no streak: the record is what you have done, not how many days in a row you
 * did it (docs/DOMINOES_RULES.md §8).
 *
 * Only a game that actually ended books a result. A game replaced by a new
 * one counted as played when it started, and counting it as lost as well
 * would make the statistics a scold (§8).
 */
import type { GameStatus } from '../game';
import type { Stats } from '../storage/schemas';

/** Registers a started game (a new deal, not a resume). */
export function applyGameStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

/** Books a finished game's result (§8). Playing status books nothing. */
export function applyGameEnd(stats: Stats, status: GameStatus): Stats {
  if (status === 'won') return { ...stats, wins: stats.wins + 1 };
  if (status === 'lost') return { ...stats, losses: stats.losses + 1 };
  if (status === 'draw') return { ...stats, draws: stats.draws + 1 };
  return stats;
}
