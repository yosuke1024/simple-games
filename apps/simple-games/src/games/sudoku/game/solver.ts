/**
 * Candidate propagation plus backtracking search (docs/SUDOKU_RULES.md §7).
 *
 * Two jobs:
 * - `solve` fills a grid (used to build the completed board a puzzle is dug
 *   from, and to know the answer a mistake is measured against).
 * - `countSolutions` decides uniqueness, stopping at the limit — digging only
 *   ever needs to know "is it still exactly one?", so counting past two is
 *   wasted work inside the per-board time budget.
 */
import { shuffled } from './rng';
import {
  ALL_CANDIDATES,
  bitOf,
  CELLS,
  digitsOf,
  PEERS,
  popcount,
  SIZE,
  type Digit,
  type Grid,
} from './types';

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

/** The empty cell with the fewest candidates, or -1 when the grid is full. */
function bestCell(grid: Grid, candidates: readonly number[]): number {
  let best = -1;
  let bestCount = SIZE + 1;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const count = popcount(candidates[i]!);
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

/** Places a digit and prunes peers. Returns false when a peer runs dry. */
function place(grid: number[], candidates: number[], index: number, digit: Digit): boolean {
  placements++;
  grid[index] = digit;
  candidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  for (const peer of PEERS[index]!) {
    if (grid[peer] !== 0) continue;
    const next = candidates[peer]! & remove;
    if (next === 0) return false;
    candidates[peer] = next;
  }
  return true;
}

function search(grid: number[], candidates: number[], order: (mask: number) => Digit[]): boolean {
  const index = bestCell(grid, candidates);
  if (index === -1) return true;
  for (const digit of order(candidates[index]!)) {
    const gridCopy = [...grid];
    const candidatesCopy = [...candidates];
    if (place(grid, candidates, index, digit) && search(grid, candidates, order)) return true;
    grid.splice(0, CELLS, ...gridCopy);
    candidates.splice(0, CELLS, ...candidatesCopy);
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
  const working = [...grid];
  const order = rng ? (mask: number) => shuffled(digitsOf(mask), rng) : digitsOf;
  return search(working, candidates, order) ? working : null;
}

/**
 * Counts solutions up to `limit` (default 2 — enough to answer "unique?").
 * Returning early is what keeps digging affordable.
 */
export function countSolutions(grid: Grid, limit = 2): number {
  const candidates = computeCandidates(grid);
  if (candidates === null) return 0;
  let found = 0;

  const recurse = (currentGrid: number[], currentCandidates: number[]): void => {
    if (found >= limit) return;
    const index = bestCell(currentGrid, currentCandidates);
    if (index === -1) {
      found++;
      return;
    }
    for (const digit of digitsOf(currentCandidates[index]!)) {
      if (found >= limit) return;
      const nextGrid = [...currentGrid];
      const nextCandidates = [...currentCandidates];
      if (place(nextGrid, nextCandidates, index, digit)) recurse(nextGrid, nextCandidates);
    }
  };

  recurse([...grid], candidates);
  return found;
}

export function hasUniqueSolution(grid: Grid): boolean {
  return countSolutions(grid, 2) === 1;
}

/** A complete, valid, seed-determined board — step 1 of generation. */
export function generateSolvedGrid(seed: string, rng: () => number): Grid {
  const empty = new Array<number>(CELLS).fill(0);
  const solved = solve(empty, rng);
  // An empty grid always has solutions; the fallback keeps the type honest.
  if (solved === null) throw new Error(`sudoku: could not build a solved grid for ${seed}`);
  return solved;
}
