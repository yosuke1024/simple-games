/**
 * Pure statistics transitions (kept out of React for unit testing).
 */
import { dayDifference, type GameSession } from '../game';
import type { Stats } from '../storage/schemas';

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, mode: 'level' | 'daily'): Stats {
  const next = structuredClone(stats);
  next[mode].played += 1;
  return next;
}

/** Registers a finished game (cleared or game over) including daily streaks. */
export function applyGameEnd(stats: Stats, session: GameSession): Stats {
  const next = structuredClone(stats);
  const mode = next[session.mode];
  mode.totalPlaySeconds += session.elapsedSeconds;

  if (session.status === 'gameOver') {
    mode.gameOver += 1;
    return next;
  }
  if (session.status !== 'cleared') return next;

  mode.cleared += 1;
  if (mode.bestClearSeconds === null || session.elapsedSeconds < mode.bestClearSeconds) {
    mode.bestClearSeconds = session.elapsedSeconds;
  }

  if (session.mode === 'daily' && session.dailyDate) {
    const daily = next.daily;
    const last = daily.lastCompletedDate;
    const diff = last === null ? null : dayDifference(last, session.dailyDate);
    // Ignore re-clears of the same date and clears of older dates (e.g. a
    // stale saved daily finished after a newer one): never move backwards.
    if (diff === null || diff > 0) {
      daily.streak = diff === 1 ? daily.streak + 1 : 1;
      daily.bestStreak = Math.max(daily.bestStreak, daily.streak);
      daily.lastCompletedDate = session.dailyDate;
    }
  }
  return next;
}

/** The streak to display today: 0 when the chain is already broken. */
export function effectiveDailyStreak(stats: Stats, today: string): number {
  const last = stats.daily.lastCompletedDate;
  if (last === null) return 0;
  const diff = dayDifference(last, today);
  return diff === 0 || diff === 1 ? stats.daily.streak : 0;
}
