/**
 * Board generation (docs/WATER_SORT_RULES.md §5).
 *
 * Shuffle a tube's worth of every color across the color tubes, then accept
 * the deal only when the solver PROVES it solvable. Rejected deals (already
 * sorted somewhere, unsolvable, or search capped) move to the next attempt —
 * the attempt number is folded into the rng, so the whole chain is a pure
 * function of the seed and every player still sees the same board.
 *
 * Construction-by-reverse-pouring could guarantee solvability without a
 * search, but it tends to produce half-sorted boards; a shuffle plays better,
 * and the proof of solvability is the same solver the Hint uses anyway (§8).
 *
 * Proven deals are then ranked by how jumbled they are (`segmentCount`), and
 * `mix` picks one by position in that order: 0 takes the tidiest of the batch,
 * 1 the most jumbled. Ranking within a batch rather than against a threshold is
 * what keeps this honest at every color count — the batch calibrates itself, so
 * no table of "what counts as jumbled for six colors" can go stale, and the
 * pick can never fail for want of a board that clears a bar.
 */
import { isTubeComplete, segmentCount } from './engine';
import { createRng, shuffled } from './rng';
import { solve } from './solver';
import { tubeCount, TUBE_CAPACITY, type Puzzle, type Tube, type Tubes } from './types';

/**
 * Attempts are cheap (a shuffle and usually a fast solve); the cap only makes
 * generation total. In practice deals are accepted almost every time, so the
 * batch below fills long before this runs out.
 */
const MAX_ATTEMPTS = 64;

/**
 * How many proven deals a board is chosen from. This is what sets how far
 * apart a band's tidiest and most jumbled levels can be: with twelve, `mix` 0
 * and 1 sit near the outer tenths of the deals a seed produces. Raising it
 * widens the spread and costs one more solve per board.
 */
const CANDIDATE_DEALS = 12;

export function generatePuzzle(seed: string, colors: number, mix: number): Puzzle {
  const rng = createRng(seed);
  const candidates: Tubes[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS && candidates.length < CANDIDATE_DEALS; attempt++) {
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

    candidates.push(tubes);
  }

  // Unreachable in practice: solvable shuffles are dense (the golden tests
  // pin real seeds). The throw is honesty — never hand out an unproven board.
  if (candidates.length === 0) {
    throw new Error(`water-sort: no solvable deal found for seed "${seed}"`);
  }

  // Deals that tie on jumbledness keep the order the seed dealt them in, so
  // the pick stays a pure function of the seed.
  const ranked = candidates
    .map((tubes, dealtAt) => ({ tubes, dealtAt, segments: segmentCount(tubes) }))
    .sort((a, b) => a.segments - b.segments || a.dealtAt - b.dealtAt);
  const position = Math.min(1, Math.max(0, mix)) * (ranked.length - 1);

  return { seed, colors, tubes: ranked[Math.round(position)]!.tubes };
}

/** Board string form for golden tests and fixtures: tubes joined by '.'. */
export function tubesToString(tubes: Tubes): string {
  return tubes.map((tube) => tube.map((color) => color.toString(36)).join('')).join('.');
}
