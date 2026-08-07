/**
 * Layout generation — implements docs/NUMBER_RECALL_RULES.md §6.
 *
 * K cells picked out of N², numbered 1..K. One shuffle does both jobs: the
 * first K entries of a shuffled index list are the cells, and their order is
 * the numbering. No constraint is placed on the result (no "consecutive tiles
 * must not touch"): a constraint means rejecting and redrawing, and a redraw
 * loop biases the layouts it finally accepts.
 */
import { createRng } from './rng';
import { cellCount, EMPTY, type Layout, type Size } from './types';

/** K numbered tiles scattered over an N² board, deterministic per seed. */
export function generateLayout(seed: string, size: Size, tiles: number): Layout {
  const count = cellCount(size);
  const total = Math.min(Math.max(1, Math.floor(tiles)), count);

  const indices: number[] = [];
  for (let index = 0; index < count; index++) indices.push(index);

  const rng = createRng(seed);
  // Fisher-Yates, back to front.
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = a;
  }

  const layout = new Array<number>(count).fill(EMPTY);
  for (let n = 0; n < total; n++) layout[indices[n]!] = n + 1;
  return layout;
}

/** Where `value` sits, or -1 when the layout does not hold it. */
export function indexOfTile(layout: Layout, value: number): number {
  return layout.indexOf(value);
}

/** Whether a layout holds exactly 1..K once each — the generator's contract. */
export function isValidLayout(layout: Layout, size: Size, tiles: number): boolean {
  if (layout.length !== cellCount(size)) return false;
  const seen = new Set<number>();
  for (const value of layout) {
    if (!Number.isInteger(value) || value < 0 || value > tiles) return false;
    if (value === EMPTY) continue;
    if (seen.has(value)) return false;
    seen.add(value);
  }
  return seen.size === tiles;
}
