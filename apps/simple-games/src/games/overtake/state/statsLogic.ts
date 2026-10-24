/**
 * The statistics and progress transitions, kept out of React for testing
 * (docs/OVERTAKE_RULES.md §9). Thin on purpose: the rules themselves are
 * game/progress.ts's pure functions; this module only carries them over the
 * persisted record shapes, so the provider never touches a field by hand.
 *
 * Counts and a total only — no place, time or bumps per level, no streak.
 */
import {
  addPlayed,
  addSeconds,
  advanceProgress,
  clearedCount,
  playableLevel,
} from '../game/progress';
import type { Progress, Stats } from '../storage/schemas';

/** A race that starts moving counts once (ready → running, §9). */
export function applyRaceStart(stats: Stats): Stats {
  return { ...stats, ...addPlayed(stats) };
}

/** Books whole seconds of running that are not booked yet (§9). */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  const next = addSeconds(stats, seconds);
  return next.totalPlaySeconds === stats.totalPlaySeconds ? stats : { ...stats, ...next };
}

/**
 * First place on `level` opens the next one; nothing else moves the
 * frontier, and nothing moves it back (§7, §9). Returns the same record when
 * nothing changed, so the caller can skip the write.
 */
export function applyFirstPlace(progress: Progress, level: number): Progress {
  const highestUnlocked = advanceProgress(progress.highestUnlocked, level, 1);
  return highestUnlocked === progress.highestUnlocked ? progress : { ...progress, highestUnlocked };
}

/** The level Play and the level picker point at — held at 100 once all are won (§11). */
export function homeLevel(progress: Progress): number {
  return playableLevel(progress.highestUnlocked);
}

/** n of the home's `n/100` (§7). */
export function clearedLevels(progress: Progress): number {
  return clearedCount(progress.highestUnlocked);
}
