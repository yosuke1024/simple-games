/**
 * Candidate propagation plus backtracking search (docs/SUDOKU_6X6_RULES.md §7).
 *
 * Two jobs:
 * - `solve` fills a grid — with a seeded digit order, that is how the
 *   completed board a puzzle is dug from is built (§7 step 1).
 * - `countSolutions` re-counts the finished puzzle's solutions, stopping at
 *   the limit, as the independent witness of §7's uniqueness invariant.
 *
 * The search runs on one working state allocated once, with a snapshot per
 * depth instead of a copy per node: nothing here is re-entrant, and 36 depths
 * is the ceiling because each level fills the cell it picks.
 */
import { shuffled } from './rng';
import { ALL_CANDIDATES, bitOf, CELLS, digitsOf, PEERS, popcount, SIZE, type Grid } from './types';
import { solverWork } from './work';

/**
 * Candidate masks for every cell (a filled cell holds its own bit), or null
 * when the grid already contradicts itself (a digit repeated in a unit, or an
 * empty cell with no candidate left).
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

/** A filled grid of digits 1–6 with no conflicts — the win condition of §2. */
export function isGridSolved(grid: Grid): boolean {
  if (grid.length !== CELLS) return false;
  for (let i = 0; i < CELLS; i++) {
    const value = grid[i]!;
    if (!Number.isInteger(value) || value < 1 || value > SIZE) return false;
  }
  return !hasConflict(grid);
}

const workGrid = new Uint8Array(CELLS);
const workCandidates = new Uint8Array(CELLS);
const gridStack = Array.from({ length: CELLS }, () => new Uint8Array(CELLS));
const candidateStack = Array.from({ length: CELLS }, () => new Uint8Array(CELLS));
const digitStack = Array.from({ length: CELLS }, () => new Uint8Array(SIZE));

const MASK_SIZE = Uint8Array.from({ length: ALL_CANDIDATES + 1 }, (_, mask) => popcount(mask));

function load(grid: Grid, candidates: readonly number[]): void {
  workGrid.set(grid);
  workCandidates.set(candidates);
}

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

/** Places a digit and prunes peers. Returns false when a peer runs dry. */
function place(index: number, digit: number): boolean {
  solverWork.add(1);
  workGrid[index] = digit;
  workCandidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  for (const peer of PEERS[index]!) {
    if (workGrid[peer] !== 0) continue;
    const next = workCandidates[peer]! & remove;
    if (next === 0) return false;
    workCandidates[peer] = next;
  }
  return true;
}

type DigitOrder = (mask: number, out: Uint8Array) => number;

const ascending: DigitOrder = (mask, out) => {
  let count = 0;
  for (let bits = mask; bits !== 0; bits &= bits - 1) {
    out[count++] = 32 - Math.clz32(bits & -bits);
  }
  return count;
};

/** Seeded order, for building a random completed board (§7 step 1). */
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

/** Counts solutions up to `limit` (default 2 — enough to answer "unique?"). */
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

/** A complete, valid, seed-determined board — step 1 of generation (§7). */
export function generateSolvedGrid(seed: string, rng: () => number): Grid {
  const solved = solve(new Array<number>(CELLS).fill(0), rng);
  // An empty grid always has solutions; the throw keeps the type honest.
  if (solved === null) throw new Error(`sudoku-6x6: could not build a solved grid for ${seed}`);
  return solved;
}
