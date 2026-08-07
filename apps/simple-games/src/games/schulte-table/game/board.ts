/**
 * Board generation — implements docs/SCHULTE_TABLE_RULES.md §6.
 *
 * A shuffle of 1..N² and nothing more. No constraint is placed on the layout
 * (no "1 and 2 must not touch"): a constraint means rejecting and redrawing,
 * and a redraw loop biases the boards it finally accepts. The scatter is the
 * random one, honestly.
 */
import { createRng } from './rng';
import { cellCount, type Size, type Values } from './types';

/** 1..N² in random positions, deterministic per seed. */
export function generateBoard(seed: string, size: Size): Values {
  const count = cellCount(size);
  const values: number[] = [];
  for (let value = 1; value <= count; value++) values.push(value);

  const rng = createRng(seed);
  // Fisher-Yates, back to front.
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = values[i]!;
    values[i] = values[j]!;
    values[j] = a;
  }
  return values;
}

/** Whether a board holds exactly 1..N² once each — the generator's contract. */
export function isValidBoard(values: Values, size: Size): boolean {
  const count = cellCount(size);
  if (values.length !== count) return false;
  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > count) return false;
    if (seen.has(value)) return false;
    seen.add(value);
  }
  return true;
}
