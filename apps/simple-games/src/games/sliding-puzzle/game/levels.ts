/**
 * Level definitions — implements docs/SLIDING_PUZZLE_RULES.md §6.
 *
 * All 100 levels come from the level number alone: a size, a shuffle depth, and
 * a seed. No content pipeline, no download, and the same level is the same
 * puzzle for every player. Undo stays unlimited and free at every level, and
 * there is no hint to gate (brand promise, §8).
 *
 * There are only three sizes, so shuffle depth carries the difficulty curve: a
 * deeper shuffle pushes the shortest solution further out. Inside a band the
 * depth rises linearly, so two neighbouring levels never jump.
 *
 * Depth only buys difficulty while the board is still settling. Once the walk
 * has mixed a board thoroughly, more slides land it somewhere just as random,
 * so the old table's deep end (a 3x3 at 120, a 4x4 at 400) was charging levels
 * for a difference no player could feel. The depths below stay inside the range
 * where the number still means something, which is also why the list is 100
 * long rather than 999: past that, the game has nothing left to vary.
 */
import type { Size } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `slide-level-${clampLevel(level)}`;
}

interface Band {
  readonly from: number;
  readonly to: number;
  readonly size: Size;
  readonly depthFrom: number;
  readonly depthTo: number;
}

/**
 * The table of §6, verbatim. A band that steps the board up restarts at a
 * shallower depth on purpose: the new size is the difficulty jump, and landing
 * on 5x5 at the depth 4x4 ended on would be two jumps at once.
 */
const BANDS: readonly Band[] = [
  { from: 1, to: 10, size: 3, depthFrom: 20, depthTo: 45 },
  { from: 11, to: 30, size: 3, depthFrom: 45, depthTo: 90 },
  { from: 31, to: 65, size: 4, depthFrom: 60, depthTo: 180 },
  { from: 66, to: MAX_LEVEL, size: 5, depthFrom: 90, depthTo: 400 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

/** Linear inside the band: the first level gets its floor, the last its top. */
export function shuffleDepthForLevel(level: number): number {
  const target = clampLevel(level);
  const band = bandFor(target);
  const span = band.to - band.from;
  if (span === 0) return band.depthFrom;
  const progress = (target - band.from) / span;
  return Math.round(band.depthFrom + (band.depthTo - band.depthFrom) * progress);
}
