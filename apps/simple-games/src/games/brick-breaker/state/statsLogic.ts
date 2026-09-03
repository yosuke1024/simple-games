/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * Counts and totals only — no score (docs/BRICK_BREAKER_RULES.md §13) and no
 * streaks.
 */
import { LEVEL_COUNT } from '../game/levels';
import type { Progress, Stats } from '../storage/schemas';

/** Registers a started attempt (new level, retry, or next level). */
export function applyAttemptStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** Registers a cleared level. Play time books through applyPlayTime, never here. */
export function applyCleared(stats: Stats): Stats {
  return { ...stats, cleared: stats.cleared + 1 };
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

/**
 * Unlocks the next level. Replaying an old level never moves the frontier
 * back. Clearing the last level moves it one past LEVEL_COUNT: there it
 * means "cleared", not "unlocked" (Bubble Pop's model), so that the count
 * below can reach 100/100 — the frontier used to stop at 100 and the count
 * at 99, with the last clear leaving no trace.
 */
export function applyClearToProgress(progress: Progress, level: number): Progress {
  const highestUnlocked = Math.min(LEVEL_COUNT + 1, Math.max(progress.highestUnlocked, level + 1));
  return highestUnlocked === progress.highestUnlocked ? progress : { ...progress, highestUnlocked };
}

/** How many levels have been cleared — the frontier minus the one being faced. */
export function clearedLevelCount(progress: Progress): number {
  return Math.max(0, Math.min(progress.highestUnlocked, LEVEL_COUNT + 1) - 1);
}
