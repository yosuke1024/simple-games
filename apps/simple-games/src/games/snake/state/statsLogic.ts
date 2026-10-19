/**
 * Pure statistics transitions (kept out of React so they can be tested on
 * their own). Four numbers per speed and no streak (docs/SNAKE_RULES.md §10):
 * the record is what you have done at that speed, not how many days in a row
 * you did it. Speeds are kept apart because fifty at Fast and fifty at Slow
 * are not the same run (§7).
 */
import { MAX_SCORE, type Speed } from '../game';
import type { SpeedStats, Stats } from '../storage/schemas';

const withSpeed = (stats: Stats, speed: Speed, next: SpeedStats): Stats => ({
  ...stats,
  [speed]: next,
});

/**
 * A run that started moving — counted once, at ready → running. A run
 * brought back from a save is not counted again (§10).
 */
export function applyRunStart(stats: Stats, speed: Speed): Stats {
  return withSpeed(stats, speed, { ...stats[speed], played: stats[speed].played + 1 });
}

/** Books running seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, speed: Speed, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return withSpeed(stats, speed, {
    ...stats[speed],
    totalPlaySeconds: stats[speed].totalPlaySeconds + seconds,
  });
}

/**
 * The record this run is measured against, or null while there is none — a
 * best of 0 is no record yet (§10). Read before `applyRunEnd`, which is what
 * moves it.
 */
export function previousBestScore(stats: Stats, speed: Speed): number | null {
  return stats[speed].bestScore > 0 ? stats[speed].bestScore : null;
}

export interface RunOutcome {
  readonly stats: Stats;
  /** True when this run scored higher than anything before it at this speed. */
  readonly isNewBestScore: boolean;
  readonly bestScore: number;
}

/**
 * Books a run that is over — crashed, filled the board, or thrown away by
 * Restart or a new run over a suspended one (§10). Every one of them counts
 * towards the best: the score was played whether or not the run reached an
 * ending. Only a full board counts as a clear.
 */
export function applyRunEnd(
  stats: Stats,
  speed: Speed,
  score: number,
  cleared: boolean,
): RunOutcome {
  const current = stats[speed];
  const bestScore = Math.min(MAX_SCORE, Math.max(current.bestScore, score));
  return {
    stats: withSpeed(stats, speed, {
      ...current,
      bestScore,
      cleared: current.cleared + (cleared ? 1 : 0),
    }),
    isNewBestScore: score > current.bestScore,
    bestScore,
  };
}
