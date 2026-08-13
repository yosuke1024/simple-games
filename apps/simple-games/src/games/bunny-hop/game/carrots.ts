/**
 * Whether the `index`-th obstacle's trailing gap carries a carrot, and drawn
 * from its own rng stream (docs/BUNNY_HOP_RULES.md §5) — never the obstacle
 * stream. Sharing a stream would mean any change here shifts every obstacle
 * draw after it, which is exactly what the golden test in
 * compatibility.test.ts exists to catch.
 */
import { CARROT_AIR_CHANCE, CARROT_CHANCE } from './constants';
import { createRng } from './rng';

export interface CarrotDraw {
  present: boolean;
  air: boolean;
}

/**
 * The `index`-th obstacle's carrot, if any. Both rolls are always made, in
 * the same order, whether or not `present` comes back true — so the stream
 * for a given index never forks depending on its own outcome.
 */
export function drawCarrot(seed: string, index: number): CarrotDraw {
  const rng = createRng(`${seed}:carrot:${index}`);
  const present = rng() < CARROT_CHANCE;
  const air = rng() < CARROT_AIR_CHANCE;
  return { present, air };
}
