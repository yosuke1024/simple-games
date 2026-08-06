/**
 * Pure statistics transitions (kept out of React so they can be tested on
 * their own). One best score for the whole game and no streaks
 * (docs/DINO_RUN_RULES.md §9).
 */
import type { Stats } from '../storage/schemas';

/** Registers a started run — a new one or a retry; they are the same thing. */
export function applyRunStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
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
 * Records a finished run. Every run counts: the distance was run whether the
 * last cactus was cleared or not (§9).
 */
export function applyRunEnd(stats: Stats, score: number, obstaclesPassed: number): ScoreOutcome {
  const isNewBestScore = score > stats.bestScore;
  const bestScore = Math.max(stats.bestScore, score);
  return {
    stats: {
      ...stats,
      bestScore,
      obstaclesPassed: stats.obstaclesPassed + Math.max(0, obstaclesPassed),
    },
    isNewBestScore,
    bestScore,
  };
}
