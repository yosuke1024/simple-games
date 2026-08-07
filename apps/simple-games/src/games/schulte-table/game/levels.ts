/**
 * Level definitions — implements docs/SCHULTE_TABLE_RULES.md §7.
 *
 * All 100 levels come from the level number alone: a size, a tap order, and a
 * seed. No content pipeline, no download, and the same level is the same board
 * for every player.
 *
 * Difficulty has two knobs and they are never turned together. A band that
 * steps the board up restarts at `ascending`, because the new size is the
 * jump; arriving at 5x5 in the order 4x4 ended on would be two jumps at once
 * (the same rule the Sliding Puzzle bands follow, docs/SLIDING_PUZZLE_RULES.md
 * §6).
 *
 * The list is 100 long rather than 999. Three sizes times three orders is nine
 * genuinely different rounds; stretched over 999 levels, hundreds of them
 * would be the same board with a different number on it.
 */
import type { Order, Size } from './types';

export const MAX_LEVEL = 100;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `schulte-level-${clampLevel(level)}`;
}

interface Band {
  readonly to: number;
  readonly size: Size;
  readonly order: Order;
}

/** The table of §7, verbatim. Every new size starts on `ascending`. */
const BANDS: readonly Band[] = [
  { to: 15, size: 3, order: 'ascending' },
  { to: 20, size: 3, order: 'descending' },
  { to: 45, size: 4, order: 'ascending' },
  { to: 55, size: 4, order: 'descending' },
  { to: 80, size: 5, order: 'ascending' },
  { to: 90, size: 5, order: 'descending' },
  { to: MAX_LEVEL, size: 5, order: 'oddThenEven' },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.to) return band;
  return BANDS[BANDS.length - 1]!;
}

export function sizeForLevel(level: number): Size {
  return bandFor(clampLevel(level)).size;
}

export function orderForLevel(level: number): Order {
  return bandFor(clampLevel(level)).order;
}
