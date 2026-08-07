/**
 * Level definitions — implements docs/NUMBER_RECALL_RULES.md §7.
 *
 * All 100 levels come from the level number alone: a size, a tile count, and a
 * seed. No content pipeline, no download.
 *
 * Difficulty has two knobs and they are never turned together. A band that
 * steps the board up starts at the tile count the previous band ended on, so
 * the new size is the only thing that changed — arriving at 5x5 with more
 * tiles as well would be two jumps at once (the rule the Sliding Puzzle bands
 * follow, docs/SLIDING_PUZZLE_RULES.md §6).
 */
import type { Size } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

/**
 * The board for one attempt at a level. The attempt number is part of the seed
 * because a retry must be a *different* layout of the same difficulty (§8):
 * the answer was shown, so the same layout would be reading it back.
 */
export function levelSeed(level: number, attempt: number): string {
  return `recall-level-${clampLevel(level)}-r${Math.max(0, Math.floor(attempt))}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  readonly tilesFrom: number;
  readonly tilesTo: number;
}

/** The table of §7, verbatim. Each band opens on the previous band's ceiling. */
const BANDS: readonly Band[] = [
  { from: 1, to: 15, size: 3, tilesFrom: 3, tilesTo: 5 },
  { from: 16, to: 55, size: 4, tilesFrom: 5, tilesTo: 9 },
  { from: 56, to: MAX_LEVEL, size: 5, tilesFrom: 9, tilesTo: 12 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Linear inside the band: the first level gets its floor, the last its top. */
export function tilesForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  if (span === 0) return band.tilesFrom;
  const progress = (target - band.from) / span;
  return Math.round(band.tilesFrom + (band.tilesTo - band.tilesFrom) * progress);
}
