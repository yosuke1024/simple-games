/**
 * Level definitions — implements docs/WATER_SORT_RULES.md §6.
 *
 * All 999 levels come from the level number alone: a color count and a seed.
 * No content pipeline, no download, and the same level is the same board for
 * every player. Undo and Hint stay unlimited and free at every level (brand
 * promise, §8).
 *
 * The color count carries the difficulty curve; the two spare tubes are
 * constant (§1), so more colors means less relative room. Inside a band,
 * variety comes from the seed alone — a band's levels are peers, and the
 * next band is the step up.
 */

export const MAX_LEVEL = 999;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `water-level-${clampLevel(level)}`;
}

interface Band {
  readonly to: number;
  readonly colors: number;
}

/** The table of §6, verbatim. */
const BANDS: readonly Band[] = [
  { to: 30, colors: 3 },
  { to: 120, colors: 4 },
  { to: 300, colors: 5 },
  { to: 500, colors: 6 },
  { to: 700, colors: 7 },
  { to: 850, colors: 8 },
  { to: MAX_LEVEL, colors: 9 },
];

export function colorsForLevel(level: number): number {
  const target = clampLevel(level);
  for (const band of BANDS) if (target <= band.to) return band.colors;
  return BANDS[BANDS.length - 1]!.colors;
}
