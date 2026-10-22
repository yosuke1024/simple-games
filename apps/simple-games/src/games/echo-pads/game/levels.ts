/**
 * The level ladder — docs/ECHO_PADS_RULES.md §2.
 *
 * Two tiers (4 pads, 6 pads) × target lengths 4..14 = 22 levels, all derived
 * from the level number. Moving up a tier changes the pad count only; the
 * target length starts again at 4, so two jumps never land at once.
 */
import type { PadCount } from './types';

export const MIN_TARGET = 4;
export const MAX_TARGET = 14;
/** Every run starts at round 3 (§1). */
export const FIRST_ROUND = 3;

const TARGETS_PER_TIER = MAX_TARGET - MIN_TARGET + 1;
const TIERS: readonly PadCount[] = [4, 6];

export const LEVEL_COUNT = TARGETS_PER_TIER * TIERS.length;

export interface LevelSpec {
  readonly level: number;
  readonly padCount: PadCount;
  readonly target: number;
  /** The first level of its tier is open from the start (§2). */
  readonly tierStart: boolean;
}

export const isLevel = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= LEVEL_COUNT;

/** The table of §2, built once. Index `level - 1`. */
export const LEVELS: readonly LevelSpec[] = Array.from({ length: LEVEL_COUNT }, (_, index) => {
  const tier = Math.floor(index / TARGETS_PER_TIER);
  const step = index % TARGETS_PER_TIER;
  return {
    level: index + 1,
    padCount: TIERS[tier]!,
    target: MIN_TARGET + step,
    tierStart: step === 0,
  };
});

/** The spec for a level, or null for anything outside 1..22. */
export function levelSpec(level: number): LevelSpec | null {
  return isLevel(level) ? LEVELS[level - 1]! : null;
}

/** The level after this one in the same tier, or null at the top of a tier. */
export function nextLevelInTier(level: number): number | null {
  const spec = levelSpec(level);
  if (!spec || spec.target === MAX_TARGET) return null;
  return level + 1;
}

/** The level before this one in the same tier, or null at a tier's start. */
export function previousLevelInTier(level: number): number | null {
  const spec = levelSpec(level);
  if (!spec || spec.tierStart) return null;
  return level - 1;
}

/**
 * The sequence for one attempt at a level. The attempt is part of the seed
 * because a retry must be a different sequence (§3, Number Recall §4・§8):
 * the failed one could be heard again as often as wanted, so the same
 * sequence would be reading it back rather than remembering it.
 */
export function levelSeed(level: number, attempt: number): string {
  return `echo-level-${level}-r${attempt}`;
}

export const isAttempt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;
