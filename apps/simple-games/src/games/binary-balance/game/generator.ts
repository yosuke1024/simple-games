/**
 * Board generation — implements docs/BINARY_BALANCE_RULES.md §6.
 *
 * 1. A finished board: rows drawn from the legal-line alphabet (§6 — 14 lines
 *    at 6 wide), placed top to bottom while the columns keep rules 1 and 2.
 *    Rows may repeat: this game has no "no two lines alike" rule (§3).
 * 2. Links: a seed-drawn number of the board's edges, in a seed-shuffled order,
 *    each `=` or `×` as the finished board says.
 * 3. Dig: cells removed one at a time in a seed-shuffled order, a removal kept
 *    only while the tier's technique set still settles every cell. One pass,
 *    no floor.
 * 4. Prune: links removed the same way, kept off only while the tier's set
 *    still finishes the board. A candidate left with no link is not this game
 *    and is dropped.
 * 5. Grade (§7), re-count the solutions with the full search, and ship on a
 *    match; otherwise derive the seed (`<seed>#2`, `#3`, …) and go again.
 * 6. At the cap, the candidate with the fewest givens ships with `fallback`.
 * 7. Throw only when there was no candidate at all.
 *
 * The gate on all of this is work, never wall clock — see `solverWork`.
 */
import { allEdges } from './engine';
import { createRng, shuffled } from './rng';
import {
  buildLayout,
  countSolutions,
  grade,
  isSolvable,
  legalMasks,
  solverWork,
  TIER_TECHNIQUES,
} from './solver';
import {
  SUN,
  EMPTY,
  MOON,
  SIZE_FOR,
  TIERS,
  cellCount,
  compareLinks,
  halfLine,
  linkOther,
  type Cell,
  type Difficulty,
  type Link,
  type Mark,
  type Size,
} from './types';

/** Derived seeds tried before shipping the best candidate anyway (§6). */
export const ATTEMPT_LIMIT = 60;

/**
 * Rows the backtracker may place before giving up on a seed (§6). A finished
 * board is easy to find; this only keeps a pathological seed from spinning.
 */
export const SEARCH_LIMIT = 20_000;

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly difficulty: Difficulty;
  readonly solution: readonly Cell[];
  /** The fixed cells (§1); EMPTY wherever the player has to work it out. */
  readonly givens: readonly Mark[];
  readonly givensCount: number;
  /** The `=` / `×` links, in canonical order (§1). Never empty (§6). */
  readonly links: readonly Link[];
  /** The tier the shipped board grades at (§7) — the target unless `fallback`. */
  readonly tier: Difficulty;
  /** How many derived seeds were drawn — 1 means the first one landed. */
  readonly attempts: number;
  /** Solver steps spent building this puzzle: the budgeted work of §6. */
  readonly work: number;
  /** True when the cap was hit and the fewest-givens candidate shipped (§6 step 6). */
  readonly fallback: boolean;
}

/**
 * A finished board keeping rules 1 and 2, or null when the search budget runs
 * out. Each row's order is a fresh seed-drawn shuffle of the alphabet, so the
 * seed decides the board; only the columns need checking while filling.
 */
export function buildSolution(rng: () => number, size: Size): Cell[] | null {
  const half = halfLine(size);
  const alphabet = legalMasks(size);
  const rows: number[] = [];
  const moonsInColumn = new Array<number>(size).fill(0);
  let placed = 0;

  const fits = (pattern: number): boolean => {
    const depth = rows.length;
    for (let col = 0; col < size; col++) {
      const square = (pattern >> col) & 1;
      const squares = moonsInColumn[col]! + square;
      if (squares > half || depth + 1 - squares > half) return false;
      if (
        depth >= 2 &&
        ((rows[depth - 1]! >> col) & 1) === square &&
        ((rows[depth - 2]! >> col) & 1) === square
      ) {
        return false;
      }
    }
    return true;
  };

  const place = (): boolean => {
    if (rows.length === size) return true;
    for (const pattern of shuffled(alphabet, rng)) {
      if (++placed > SEARCH_LIMIT) return false;
      if (!fits(pattern)) continue;
      rows.push(pattern);
      for (let col = 0; col < size; col++) moonsInColumn[col]! += (pattern >> col) & 1;
      if (place()) return true;
      rows.pop();
      for (let col = 0; col < size; col++) moonsInColumn[col]! -= (pattern >> col) & 1;
    }
    return false;
  };

  if (!place()) return null;
  const cells: Cell[] = [];
  for (const pattern of rows) {
    for (let col = 0; col < size; col++) cells.push(((pattern >> col) & 1) === 1 ? MOON : SUN);
  }
  return cells;
}

/** The first `count` edges of a seed-shuffled order, read off the solution (§6 step 2). */
function drawLinks(
  solution: readonly Cell[],
  size: Size,
  count: number,
  rng: () => number,
): Link[] {
  return shuffled(allEdges(size), rng)
    .slice(0, count)
    .map((edge) => ({
      ...edge,
      same: solution[edge.index] === solution[linkOther(edge, size)],
    }));
}

interface Candidate {
  readonly solution: Cell[];
  readonly givens: Mark[];
  readonly links: Link[];
  readonly count: number;
  readonly tier: Difficulty;
}

/** One derived seed's candidate (§6 steps 1–4), or null when it cannot be one. */
function buildCandidate(derived: string, difficulty: Difficulty): Candidate | null {
  const size = SIZE_FOR[difficulty];
  const techniques = TIER_TECHNIQUES[difficulty];
  const rng = createRng(derived);

  const solution = buildSolution(rng, size);
  if (solution === null) return null;

  const { minLinks, maxLinks } = TIERS[difficulty];
  const linkCount = minLinks + Math.floor(rng() * (maxLinks - minLinks + 1));
  let links = drawLinks(solution, size, linkCount, rng);
  let layout = buildLayout(links, size);

  // Dig (§6 step 3). One pass is enough: fewer givens can only ever prove
  // less, so a cell that could not go earlier can never go later.
  const givens: Mark[] = [...solution];
  for (const index of shuffled(
    Array.from({ length: cellCount(size) }, (_, i) => i),
    rng,
  )) {
    const removed = givens[index]!;
    givens[index] = EMPTY;
    if (!isSolvable(givens, layout, techniques)) givens[index] = removed;
  }

  // Prune (§6 step 4): the links that remain are the ones this many givens
  // need to settle the board.
  for (const link of shuffled(links, rng)) {
    const without = links.filter((kept) => kept !== link);
    const trial = buildLayout(without, size);
    if (isSolvable(givens, trial, techniques)) {
      links = without;
      layout = trial;
    }
  }
  if (links.length === 0) return null;

  // Graded and re-counted: the technique solver is checked, never trusted.
  const tier = grade(givens, layout);
  if (tier === null) return null;
  if (countSolutions(givens, layout, 2) !== 1) return null;

  const count = givens.reduce<number>((sum, cell) => sum + (cell === EMPTY ? 0 : 1), 0);
  return { solution, givens, links: [...links].sort(compareLinks), count, tier };
}

/**
 * The same seed always returns the same puzzle (§6): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the puzzle that ships is a
 * pure function of the seed and the difficulty alone.
 *
 * `attemptLimit` is a test seam into §6 step 6; production never passes it.
 */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
  attemptLimit: number = ATTEMPT_LIMIT,
): GeneratedPuzzle {
  const size = SIZE_FOR[difficulty];
  const before = solverWork.read();
  let best: Candidate | null = null;
  let drawn = 0;

  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    drawn = attempt;
    const derived = attempt === 1 ? seed : `${seed}#${attempt}`;
    const candidate = buildCandidate(derived, difficulty);
    if (candidate === null) continue;
    if (candidate.tier === difficulty) {
      return {
        size,
        difficulty,
        solution: candidate.solution,
        givens: candidate.givens,
        givensCount: candidate.count,
        links: candidate.links,
        tier: candidate.tier,
        attempts: attempt,
        work: solverWork.read() - before,
        fallback: false,
      };
    }
    if (best === null || candidate.count < best.count) best = candidate;
  }

  // A board easier than asked is still unique and still needs no guessing,
  // so it may ship, flagged (§6 step 6). No candidate at all means this file
  // is broken, and an empty board with nothing to tap is not a puzzle (step 7).
  if (best === null) {
    throw new Error(
      `binary-balance: no ${difficulty} candidate after ${drawn} seeds from "${seed}"`,
    );
  }
  return {
    size,
    difficulty,
    solution: best.solution,
    givens: best.givens,
    givensCount: best.count,
    links: best.links,
    tier: best.tier,
    attempts: drawn,
    work: solverWork.read() - before,
    fallback: true,
  };
}
