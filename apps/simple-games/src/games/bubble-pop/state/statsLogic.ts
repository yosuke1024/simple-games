/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * Counts and totals only — no score
 * (docs/plans/2026-08-08-mahjong-bubble-ludo.md §Bubble Pop) and no streaks.
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

/** Unlocks the next level. Replaying an old level never moves the frontier back. */
export function applyClearToProgress(progress: Progress, level: number): Progress {
  const highestUnlocked = Math.min(LEVEL_COUNT, Math.max(progress.highestUnlocked, level + 1));
  return highestUnlocked === progress.highestUnlocked ? progress : { ...progress, highestUnlocked };
}

/** How many levels have been cleared — the frontier minus the one being faced. */
export function clearedLevelCount(progress: Progress): number {
  return progress.highestUnlocked - 1;
}
