/**
 * Level definitions — implements docs/NONOGRAM_RULES.md §6.
 *
 * All 999 levels come from the level number alone: a size, a fill rate, and a
 * seed. No content pipeline, no download, and the same level is the same
 * puzzle for every player.
 *
 * There are only two sizes (§1), so the fill rate carries the difficulty
 * curve: dense boards grow long runs that decide themselves quickly, and
 * loosening the fill loosens the clues. Inside a band the rate moves linearly,
 * so two neighbouring levels never jump.
 */
import type { Size } from './types';

export const MAX_LEVEL = 999;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `nono-level-${clampLevel(level)}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  readonly fillFrom: number;
  readonly fillTo: number;
}

/** The table of §6, verbatim. */
const BANDS: readonly Band[] = [
  { from: 1, to: 120, size: 5, fillFrom: 0.6, fillTo: 0.55 },
  { from: 121, to: 500, size: 10, fillFrom: 0.6, fillTo: 0.55 },
  { from: 501, to: MAX_LEVEL, size: 10, fillFrom: 0.55, fillTo: 0.48 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Linear inside the band: the first level gets its floor, the last its top. */
export function fillRateForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  if (span === 0) return band.fillFrom;
  const progress = (target - band.from) / span;
  return band.fillFrom + (band.fillTo - band.fillFrom) * progress;
}
