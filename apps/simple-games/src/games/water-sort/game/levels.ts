/**
 * Level definitions — implements docs/WATER_SORT_RULES.md §6.
 *
 * All 100 levels come from the level number alone: a color count, a starting
 * mix, and a seed. No content pipeline, no download, and the same level is the
 * same board for every player. Undo and Hint stay unlimited and free at every
 * level (brand promise, §8).
 *
 * The color count is the coarse curve; the two spare tubes are constant (§1),
 * so more colors means less relative room. There are only seven color counts,
 * though, and a list of 999 levels made that painfully clear: a band ran for
 * hundreds of levels in which every board was the same job with a different
 * seed. So the list is 100 long, and each band also runs a second knob — how
 * jumbled the deal starts (§6, generator.ts) — from its tidy end to its
 * jumbled one. The endless side of the game is the daily board, unchanged.
 */

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `water-level-${clampLevel(level)}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly colors: number;
}

/** The table of §6, verbatim. */
const BANDS: readonly Band[] = [
  { from: 1, to: 8, colors: 3 },
  { from: 9, to: 22, colors: 4 },
  { from: 23, to: 40, colors: 5 },
  { from: 41, to: 60, colors: 6 },
  { from: 61, to: 78, colors: 7 },
  { from: 79, to: 92, colors: 8 },
  { from: 93, to: MAX_LEVEL, colors: 9 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function colorsForLevel(level: number): number {
  return bandFor(clampLevel(level)).colors;
}

/**
 * How jumbled a level's deal starts, 0 (the tidiest deal the generator saw) to
 * 1 (the most jumbled). Linear inside the band: the first level of a band gets
 * its tidiest board and the last its most jumbled, so a band is a climb of its
 * own rather than a plateau, and stepping into the next band starts gently
 * again at one more color.
 */
export function mixForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  return span === 0 ? 0 : (target - band.from) / span;
}

/**
 * Free Play's tiers (§6「フリープレイ」). A tier is not a new knob: it is one
 * level's generation parameters — colour count and starting mix — dealt
 * under a seed of its own. Easy stands in the four-colour band, medium at the
 * daily's six, hard near the top of the list. Nothing to tune, nothing that
 * can drift from the curve the levels already walk.
 */
export type FreeTier = 'easy' | 'medium' | 'hard';
export const FREE_TIERS: readonly FreeTier[] = ['easy', 'medium', 'hard'];
export const FREE_TIER_LEVEL: Record<FreeTier, number> = { easy: 10, medium: 50, hard: 95 };
