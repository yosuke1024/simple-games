/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * One best score for the whole game and no streaks
 * (docs/SKY_FIGHTER_RULES.md §9).
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

export interface ScoreOutcome {
  readonly stats: Stats;
  /** True when this run beat the previous best score. */
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
}

/**
 * Records a run's score. A failed run counts too: the points were scored
 * whether or not the last wave fell (§9).
 */
export function applyRunScore(stats: Stats, score: number): ScoreOutcome {
  const isNewBestScore = score > stats.bestScore;
  const bestScore = Math.max(stats.bestScore, score);
  return {
    stats: isNewBestScore ? { ...stats, bestScore } : stats,
    isNewBestScore,
    bestScore,
  };
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
