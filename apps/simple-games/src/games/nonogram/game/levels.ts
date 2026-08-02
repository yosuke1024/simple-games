/**
 * Level definitions — implements docs/NONOGRAM_RULES.md §6.
 *
 * All 100 levels come from the level number alone: a size, a fill rate, and a
 * seed. No content pipeline, no download, and the same level is the same
 * puzzle for every player.
 *
 * There are only two sizes (§1), so the fill rate carries the difficulty
 * curve: dense boards grow long runs that decide themselves quickly, and
 * loosening the fill loosens the clues. Inside a band the rate moves linearly,
 * so two neighbouring levels never jump.
 *
 * The list is 100 long rather than 999 for the reason the fill rate makes
 * plainest: spread over 999 levels the rate crept by well under a tenth of a
 * cell per level, so hundreds of levels in a row were the same puzzle with a
 * different seed. Across 100 the same span of rates is a curve a player can
 * feel, and the endless side of the game is the daily puzzle, unchanged.
 */
import type { Size } from './types';

export const MAX_LEVEL = 100;

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
  { from: 1, to: 20, size: 5, fillFrom: 0.6, fillTo: 0.55 },
  { from: 21, to: 60, size: 10, fillFrom: 0.6, fillTo: 0.54 },
  { from: 61, to: MAX_LEVEL, size: 10, fillFrom: 0.54, fillTo: 0.48 },
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
