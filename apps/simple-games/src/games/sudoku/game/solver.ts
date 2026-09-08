/**
 * Candidate propagation plus backtracking search (docs/SUDOKU_RULES.md §7).
 *
 * Three jobs:
 * - `solve` fills a grid (used to build the completed board a puzzle is dug
 *   from, and to know the answer a mistake is measured against).
 * - `countSolutions` decides uniqueness, stopping at the limit — digging only
 *   ever needs to know "is it still exactly one?", so counting past two is
 *   wasted work inside the per-board time budget.
 * - `hasSolutionDifferingAt` asks the narrower question a dig step really has,
 *   for a price the caller fixes in advance.
 */
import { shuffled } from './rng';
import { ALL_CANDIDATES, bitOf, CELLS, digitsOf, PEERS, popcount, SIZE, type Grid } from './types';

/**
 * Candidate masks for every empty cell, or null when the grid already
 * contradicts itself (a filled cell repeated in a unit, or an empty cell with
 * no candidate left).
 */
export function computeCandidates(grid: Grid): number[] | null {
  const candidates = new Array<number>(CELLS).fill(ALL_CANDIDATES);
  for (let i = 0; i < CELLS; i++) {
    const value = grid[i]!;
    if (value === 0) continue;
    candidates[i] = bitOf(value);
    for (const peer of PEERS[i]!) {
      if (grid[peer] === value) return null;
    }
  }
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    let mask = ALL_CANDIDATES;
    for (const peer of PEERS[i]!) {
      const value = grid[peer]!;
      if (value !== 0) mask &= ~bitOf(value);
    }
    if (mask === 0) return null;
    candidates[i] = mask;
  }
  return candidates;
}

/** Whether the grid breaks a row/column/box rule as it stands. */
export function hasConflict(grid: Grid): boolean {
  for (let i = 0; i < CELLS; i++) {
    const value = grid[i]!;
    if (value === 0) continue;
    for (const peer of PEERS[i]!) {
      if (grid[peer] === value) return true;
    }
  }
  return false;
}

export function isGridComplete(grid: Grid): boolean {
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0) return false;
  return true;
}

/** A filled grid with no conflicts — the win condition of §2. */
export function isGridSolved(grid: Grid): boolean {
  return isGridComplete(grid) && !hasConflict(grid);
}

/**
 * The one working state every search runs on, allocated once.
 *
 * A node used to copy the grid and the masks into fresh arrays and splice them
 * back on the way out: digging one hard board built and discarded a few
 * hundred thousand 81-element arrays, about half the cost of the uniqueness
 * checks that dominate generation. It is also the whole reason timing the same
 * seed twice disagrees — the spread §7 measures is where the collector landed,
 * not what the search did.
 *
 * A snapshot per depth replaces the copies. Nothing here is re-entrant — no
 * search ever runs inside another — so one working pair serves every entry
 * point, and 81 depths is the ceiling because each level fills the cell it
 * picks.
 */
const workGrid = new Uint8Array(CELLS);
const workCandidates = new Uint16Array(CELLS);
const gridStack = Array.from({ length: CELLS }, () => new Uint8Array(CELLS));
const candidateStack = Array.from({ length: CELLS }, () => new Uint16Array(CELLS));
const digitStack = Array.from({ length: CELLS }, () => new Uint8Array(SIZE));

/** Starts a search from a caller's grid, which is only ever read. */
function load(grid: Grid, candidates: readonly number[]): void {
  workGrid.set(grid);
  workCandidates.set(candidates);
}

/**
 * How many candidates each of the 512 masks holds. `bestCell` weighs every
 * empty cell on every node, so counting those bits one at a time is the
 * most-run loop there is; the table is 512 bytes and answers in one read.
 */
const MASK_SIZE = Uint8Array.from({ length: ALL_CANDIDATES + 1 }, (_, mask) => popcount(mask));

/** The empty cell with the fewest candidates, or -1 when the grid is full. */
function bestCell(): number {
  let best = -1;
  let bestCount = SIZE + 1;
  for (let i = 0; i < CELLS; i++) {
    if (workGrid[i] !== 0) continue;
    const count = MASK_SIZE[workCandidates[i]!]!;
    if (count < bestCount) {
      best = i;
      bestCount = count;
      if (count === 1) break;
    }
  }
  return best;
}

/**
 * Every digit the search tries, counted since the last reset.
 *
 * This is the unit of work generation is made of: digging a board is a few
 * dozen uniqueness checks, and each one is a backtracking search whose cost is
 * the number of placements it explores. A stopwatch measures that work times
 * whatever else the machine happened to be doing; this counts the work itself,
 * and a seed always produces the same count on any machine. That is what makes
 * the §7 budget assertable rather than merely observable — see
 * `generator.test.ts`.
 *
 * Nothing at runtime reads it; it costs one integer increment per placement.
 */
let placements = 0;

export const searchWork = {
  read: (): number => placements,
  reset: (): void => {
    placements = 0;
  },
};

/**
 * `PEERS` flattened into one row per cell. Pruning peers is what a placement
 * is, so this is walked once per unit of §7 work; a flat table is a read per
 * peer where the array of arrays is a chase plus an iterator.
 */
const PEER_COUNT = PEERS[0]!.length;
const FLAT_PEERS = new Uint8Array(CELLS * PEER_COUNT);
for (let i = 0; i < CELLS; i++) FLAT_PEERS.set(PEERS[i]!, i * PEER_COUNT);

/** Places a digit and prunes peers. Returns false when a peer runs dry. */
function place(index: number, digit: number): boolean {
  placements++;
  workGrid[index] = digit;
  workCandidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  const end = index * PEER_COUNT + PEER_COUNT;
  for (let p = index * PEER_COUNT; p < end; p++) {
    const peer = FLAT_PEERS[p]!;
    if (workGrid[peer] !== 0) continue;
    const next = workCandidates[peer]! & remove;
    if (next === 0) return false;
    workCandidates[peer] = next;
  }
  return true;
}

/**
 * Writes the digits to try at a node into `out` and returns how many there
 * are. A borrowed buffer rather than a fresh array because this runs once per
 * node, on the same path the snapshots exist to keep allocation-free.
 */
type DigitOrder = (mask: number, out: Uint8Array) => number;

/** Ascending, the order `digitsOf` gives — read straight off the mask. */
const ascending: DigitOrder = (mask, out) => {
  let count = 0;
  for (let bits = mask; bits !== 0; bits &= bits - 1) {
    out[count++] = 32 - Math.clz32(bits & -bits);
  }
  return count;
};

/**
 * Seeded order, for building a random completed board. This one still builds
 * an array per node, and can afford to: the board it orders is built once per
 * puzzle, where the ascending order runs in every dig step's search. Borrowing
 * `shuffled` keeps one definition of the draw order a seed's board depends on.
 */
const shuffledBy =
  (rng: () => number): DigitOrder =>
  (mask, out) => {
    const digits = shuffled(digitsOf(mask), rng);
    for (let i = 0; i < digits.length; i++) out[i] = digits[i]!;
    return digits.length;
  };

function search(depth: number, order: DigitOrder): boolean {
  const index = bestCell();
  if (index === -1) return true;
  const digits = digitStack[depth]!;
  const count = order(workCandidates[index]!, digits);
  const savedGrid = gridStack[depth]!;
  const savedCandidates = candidateStack[depth]!;
  savedGrid.set(workGrid);
  savedCandidates.set(workCandidates);
  for (let i = 0; i < count; i++) {
    if (place(index, digits[i]!) && search(depth + 1, order)) return true;
    workGrid.set(savedGrid);
    workCandidates.set(savedCandidates);
  }
  return false;
}

/**
 * Solves the grid, or returns null when it has no solution. With `rng` the
 * digit order is shuffled, which is how a random completed board is built.
 */
export function solve(grid: Grid, rng?: () => number): Grid | null {
  const candidates = computeCandidates(grid);
  if (candidates === null) return null;
  load(grid, candidates);
  return search(0, rng ? shuffledBy(rng) : ascending) ? Array.from(workGrid) : null;
}

/**
 * Counts solutions up to `limit` (default 2 — enough to answer "unique?").
 * Returning early is what keeps digging affordable.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const candidates = computeCandidates(grid);
  if (candidates === null) return 0;
  load(grid, candidates);
  let found = 0;

  const recurse = (depth: number): void => {
    if (found >= limit) return;
    const index = bestCell();
    if (index === -1) {
      found++;
      return;
    }
    const digits = digitStack[depth]!;
    const count = ascending(workCandidates[index]!, digits);
    const savedGrid = gridStack[depth]!;
    const savedCandidates = candidateStack[depth]!;
    savedGrid.set(workGrid);
    savedCandidates.set(workCandidates);
    for (let i = 0; i < count; i++) {
      if (found >= limit) return;
      if (place(index, digits[i]!)) recurse(depth + 1);
      workGrid.set(savedGrid);
      workCandidates.set(savedCandidates);
    }
  };

  recurse(0);
  return found;
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

/** What a bounded search could establish before it ran out of budget. */
export type OtherSolution = 'found' | 'none' | 'unknown';

/**
 * Whether `grid` admits a solution that differs from `known` on at least one
 * of `cells` (each of which is empty in `grid`), looking at no more than
 * `budget` placements. 'unknown' means the budget ran out first.
 *
 * This is the question digging actually asks. The board before a removal is
 * already unique with solution `known`, so any solution of `grid` agreeing
 * with `known` on every removed cell also solves the board before the removal
 * — and is therefore `known` itself. A second solution has to differ on one of
 * the removed cells, which turns "count to two" into "find one", over the
 * partition by the first cell where the difference shows: force `cells[j]` to
 * `known` for every j < k, forbid `known` at `cells[k]`, and look for any
 * solution at all. Each partition is a first-solution search, so it stops at
 * the first witness instead of proving a second one exists the long way.
 *
 * The budget is one allowance shared by every partition, and it is what makes
 * the question safe to ask about an expensive board: 'unknown' costs the
 * caller a bounded amount and it can simply keep the clue, where insisting on
 * a definite answer would cost whatever the board demanded.
 */
export function hasSolutionDifferingAt(
  grid: Grid,
  known: Grid,
  cells: readonly number[],
  budget: number,
): OtherSolution {
  const candidates = computeCandidates(grid);
  if (candidates === null) return 'none';
  let left = budget;

  const firstSolution = (depth: number): OtherSolution => {
    const index = bestCell();
    if (index === -1) return 'found';
    const digits = digitStack[depth]!;
    const count = ascending(workCandidates[index]!, digits);
    const savedGrid = gridStack[depth]!;
    const savedCandidates = candidateStack[depth]!;
    savedGrid.set(workGrid);
    savedCandidates.set(workCandidates);
    for (let i = 0; i < count; i++) {
      if (left <= 0) return 'unknown';
      left--;
      if (place(index, digits[i]!)) {
        const outcome = firstSolution(depth + 1);
        if (outcome !== 'none') return outcome;
      }
      workGrid.set(savedGrid);
      workCandidates.set(savedCandidates);
    }
    return 'none';
  };

  for (let k = 0; k < cells.length; k++) {
    load(grid, candidates);

    // The cells before k are pinned to the known solution, propagated the same
    // way the search would; a pin the masks no longer allow just means this
    // partition holds nothing.
    let empty = false;
    for (let j = 0; j < k; j++) {
      const cell = cells[j]!;
      const digit = known[cell]!;
      if ((workCandidates[cell]! & bitOf(digit)) === 0) {
        empty = true;
        break;
      }
      if (left <= 0) return 'unknown';
      left--;
      if (!place(cell, digit)) {
        empty = true;
        break;
      }
    }
    if (empty) continue;

    const target = cells[k]!;
    const others = workCandidates[target]! & ~bitOf(known[target]!);
    if (others === 0) continue;
    workCandidates[target] = others;

    const outcome = firstSolution(0);
    if (outcome !== 'none') return outcome;
  }
  return 'none';
}

/** A complete, valid, seed-determined board — step 1 of generation. */
export function generateSolvedGrid(seed: string, rng: () => number): Grid {
  const empty = new Array<number>(CELLS).fill(0);
  const solved = solve(empty, rng);
  // An empty grid always has solutions; the fallback keeps the type honest.
  if (solved === null) throw new Error(`sudoku: could not build a solved grid for ${seed}`);
  return solved;
}
