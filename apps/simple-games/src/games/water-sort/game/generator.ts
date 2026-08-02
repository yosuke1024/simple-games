/**
 * Board generation (docs/WATER_SORT_RULES.md §5).
 *
 * Shuffle a tube's worth of every color across the color tubes, then accept
 * the board only when the solver PROVES it solvable. Rejected boards (already
 * sorted somewhere, unsolvable, or search capped) move to the next attempt —
 * the attempt number is folded into the rng, so the whole retry chain is a
 * pure function of the seed and every player still sees the same board.
 *
 * Construction-by-reverse-pouring could guarantee solvability without a
 * search, but it tends to produce half-sorted boards; a shuffle plays better,
 * and the proof of solvability is the same solver the Hint uses anyway (§8).
 */
import { isTubeComplete } from './engine';
import { createRng, shuffled } from './rng';
import { solve } from './solver';
import { tubeCount, TUBE_CAPACITY, type Puzzle, type Tube, type Tubes } from './types';

/**
 * Attempts are cheap (a shuffle and usually a fast solve); the cap only makes
 * generation total. In practice the first attempt is accepted almost always,
 * and the golden tests would catch a seed that ever came close to the cap.
 */
const MAX_ATTEMPTS = 64;

export function generatePuzzle(seed: string, colors: number): Puzzle {
  const rng = createRng(seed);

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const units: number[] = [];
    for (let color = 0; color < colors; color++) {
      for (let i = 0; i < TUBE_CAPACITY; i++) units.push(color);
    }
    const dealt = shuffled(units, rng);

    const tubes: Tube[] = [];
    for (let t = 0; t < colors; t++) {
      tubes.push(dealt.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY));
    }
    for (let t = colors; t < tubeCount(colors); t++) tubes.push([]);

    // A board that starts with a finished tube hands out a freebie; deal
    // again rather than shipping it (§5).
    if (tubes.some(isTubeComplete)) continue;
    if (solve(tubes).status !== 'solved') continue;

    return { seed, colors, tubes };
  }

  // Unreachable in practice: solvable shuffles are dense (the golden tests
  // pin real seeds). The throw is honesty — never hand out an unproven board.
  throw new Error(`water-sort: no solvable deal found for seed "${seed}"`);
}

/** Board string form for golden tests and fixtures: tubes joined by '.'. */
export function tubesToString(tubes: Tubes): string {
  return tubes.map((tube) => tube.map((color) => color.toString(36)).join('')).join('.');
}
