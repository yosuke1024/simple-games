/**
 * Pure statistics transitions (kept out of React for testing). Counts, two
 * personal records, and one total — no streaks (docs/SNAKE_RULES.md §9).
 */
import type { Stats } from '../storage/schemas';

/** Registers a started attempt. Every board mounted is one of these. */
export function applyAttemptStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** Books play seconds that have not been counted yet (§9). */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

export interface RunEnd {
  readonly score: number;
  readonly length: number;
}

export interface RunOutcomeStats {
  readonly stats: Stats;
  readonly isNewBestScore: boolean;
  readonly isNewBestLength: boolean;
}

/**
 * Records a finished run. Both records move on the same run when it earns
 * both, and neither is conditional on the ending: there is no "clear" to
 * qualify for, so what was scored was scored (§2, §9).
 */
export function applyRunEnd(stats: Stats, run: RunEnd): RunOutcomeStats {
  const isNewBestScore = run.score > stats.bestScore;
  const isNewBestLength = run.length > stats.bestLength;
  if (!isNewBestScore && !isNewBestLength) {
    return { stats, isNewBestScore, isNewBestLength };
  }
  return {
    stats: {
      ...stats,
      bestScore: Math.max(stats.bestScore, run.score),
      bestLength: Math.max(stats.bestLength, run.length),
    },
    isNewBestScore,
    isNewBestLength,
  };
}
