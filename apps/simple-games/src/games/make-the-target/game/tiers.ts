/**
 * The tier table of docs/MAKE_THE_TARGET_RULES.md §7 — a leaf: it imports
 * nothing but types, so both the generator and the restore path read it
 * (§5「game/ のモジュールの境界」, held by searchBoundary.test.ts).
 *
 * The values are the ones the Phase 2 measurement settled (§7, §15).
 */
import type { Difficulty, Operator } from './types';

/**
 * The most tiles a saved problem's shape could ever hold (§1): the plan's
 * "4 to 6", and what one stored slot digit `0`–`5` can name (§10). No v1 tier
 * deals 6 — `isDealableShape` refuses them.
 */
export const MAX_TILES = 6;

export interface TierSpec {
  /** How many tiles are dealt; one is drawn with equal chance (§6 step 2). */
  readonly tileCounts: readonly number[];
  /** The range every ordinary number is drawn from. */
  readonly small: readonly [min: number, max: number];
  /**
   * Hard only: how many numbers come from the large range (each count
   * equally likely) and that range. Null for the tiers without them.
   */
  readonly large: {
    readonly counts: readonly number[];
    readonly range: readonly [min: number, max: number];
  } | null;
  /** The target band, inclusive (§7). */
  readonly targetRange: readonly [min: number, max: number];
  /** The operators the generator builds its solution with (§6 step 3). */
  readonly buildOperators: readonly Operator[];
}

export const TIERS: Record<Difficulty, TierSpec> = {
  easy: {
    tileCounts: [4],
    small: [1, 10],
    large: null,
    targetRange: [10, 24],
    buildOperators: ['+', '-', '*'],
  },
  medium: {
    tileCounts: [4, 5],
    small: [1, 10],
    large: null,
    targetRange: [10, 60],
    buildOperators: ['+', '-', '*', '/'],
  },
  hard: {
    tileCounts: [5],
    small: [1, 10],
    large: { counts: [1, 2], range: [11, 25] },
    targetRange: [50, 300],
    buildOperators: ['+', '-', '*', '/'],
  },
};

/** Medium's acceptance ceiling on `ways` for a problem ÷ is not needed for (§7 (b)). */
export const MEDIUM_WAYS_MAX = 200;
/** Easy's floor on `ways` (§7). */
export const EASY_WAYS_MIN = 4;
/** Hard's ceiling on `ways` (§7). */
export const HARD_WAYS_MAX = 40;

const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const within = (value: number, [min, max]: readonly [number, number]): boolean =>
  value >= min && value <= max;

/**
 * Whether `numbers` and `target` have the shape this tier deals (§7, §10):
 * a tile count the tier deals, ascending, every number in range (Hard: one
 * or two from the large range, the rest small), and the target in its band.
 * Never throws, whatever it is given — the restore path calls it on what
 * came off the disk.
 */
export function isDealableShape(
  difficulty: Difficulty,
  numbers: unknown,
  target: unknown,
): boolean {
  const tier = TIERS[difficulty];
  if (!Array.isArray(numbers) || !tier.tileCounts.includes(numbers.length)) return false;
  if (!isWhole(target) || !within(target, tier.targetRange)) return false;
  let large = 0;
  let previous = -Infinity;
  for (const value of numbers as unknown[]) {
    if (!isWhole(value) || value < previous) return false;
    previous = value;
    if (within(value, tier.small)) continue;
    if (tier.large !== null && within(value, tier.large.range)) {
      large++;
      continue;
    }
    return false;
  }
  return tier.large === null ? large === 0 : tier.large.counts.includes(large);
}

/** What the enumeration counted for one problem (§6「数え方」). */
export interface WayCounts {
  readonly ways: number;
  readonly waysWithoutDivision: number;
}

/**
 * The tier's acceptance condition (§7) — one predicate of the problem alone:
 * its shape, `ways` and `waysWithoutDivision`. Neither the seed nor which
 * Medium round built it is an input, so the generator's output and the
 * bundled problems are checked by the same function.
 */
export function meetsTier(
  difficulty: Difficulty,
  numbers: readonly number[],
  target: number,
  counts: WayCounts,
): boolean {
  if (!isDealableShape(difficulty, numbers, target)) return false;
  const { ways, waysWithoutDivision } = counts;
  switch (difficulty) {
    case 'easy':
      return ways >= EASY_WAYS_MIN && waysWithoutDivision >= 1;
    case 'medium':
      if (ways < 1) return false;
      if (waysWithoutDivision === 0) return true;
      return ways <= MEDIUM_WAYS_MAX && !meetsTier('easy', numbers, target, counts);
    case 'hard':
      return ways >= 1 && ways <= HARD_WAYS_MAX;
  }
}
