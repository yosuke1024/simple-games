/**
 * Puzzle generation (docs/SUDOKU_6X6_RULES.md §6, §7).
 *
 * Per attempt: build a completed board from the seed, then dig it in seed
 * order while the tier's technique set can still finish it, down to the
 * tier's floor. A tier is therefore a promise about two things at once —
 * which techniques a board may demand, and how few clues it keeps — and both
 * hold by construction (§6).
 *
 * What a tier does NOT promise is that its highest technique is *needed*.
 * That was the first definition and it was measured and dropped (§6): a 6×6
 * dug to its floor is almost always finished by singles alone. Searching up
 * to sixty derived seeds for each of forty seeds, only 4 of 40 Medium runs
 * found a board that needed locked candidates, and no Hard run found one that
 * needed a pair — "needed" could only have been kept by shipping fallbacks
 * nearly every time. `tier` reports what each board actually needs, for the statistics
 * the guarantee test prints.
 *
 * Derived seeds (`<seed>#2`, …) remain as a defence only: a dug board that
 * failed the final uniqueness count would be rebuilt from the next one. No
 * walked seed has ever needed one.
 *
 * Everything derives from the seed, so a date or a token yields the same
 * puzzle on every device with no content pipeline and no download.
 */
import { gradeTier, solvableWithin } from './grader';
import { createRng, shuffled } from './rng';
import { countSolutions, generateSolvedGrid } from './solver';
import { CELLS, SIZE, type Difficulty, type Grid } from './types';
import { solverWork } from './work';

/** Derived seeds per board, at most (§7 step 4) — a defensive ceiling. */
export const ATTEMPT_LIMIT = 60;

/**
 * How each tier digs (§6): where it stops, and whether removals come in
 * 180°-rotation pairs (a 6×6 has no centre cell, so every group is a pair)
 * or one cell at a time.
 */
export const DIG_PLAN: Record<
  Difficulty,
  { readonly minGivens: number; readonly symmetric: boolean }
> = {
  easy: { minGivens: 16, symmetric: true },
  medium: { minGivens: 11, symmetric: true },
  hard: { minGivens: 8, symmetric: false },
};

/** A generated puzzle and what it cost (§7). */
export interface GeneratedPuzzle {
  readonly seed: string;
  /** The tier asked for — the technique set the board is guaranteed to yield to. */
  readonly difficulty: Difficulty;
  /** Clues, 0 for the cells the player fills. */
  readonly givens: Grid;
  readonly solution: Grid;
  /**
   * The lowest tier whose techniques finish the board — never above
   * `difficulty`, and often below it (§6). Reported, not promised.
   */
  readonly tier: Difficulty;
  /** Seeds drawn, the original included. */
  readonly attempts: number;
  /** `solverWork` spent on this board, all attempts included (§7). */
  readonly work: number;
}

function removalGroups(symmetric: boolean): readonly (readonly number[])[] {
  if (!symmetric) return Array.from({ length: CELLS }, (_, index) => [index]);
  const groups: number[][] = [];
  for (let i = 0; i < CELLS / 2; i++) groups.push([i, CELLS - 1 - i]);
  return groups;
}

const PAIRS = removalGroups(true);
const SINGLES = removalGroups(false);

export function givensCount(grid: Grid): number {
  let count = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] !== 0) count++;
  return count;
}

/**
 * Steps 1 and 2 of §7 for one seed: a completed board, then one pass of
 * removals in seed order, each kept only while the tier's techniques still
 * finish the board, stopping at the tier's floor. One pass is enough: fewer
 * clues only ever admit more solutions, so a removal refused once would be
 * refused again.
 */
export function digBoard(seed: string, target: Difficulty): { givens: Grid; solution: Grid } {
  const rng = createRng(seed);
  const solution = generateSolvedGrid(seed, rng);
  const givens = [...solution];
  const plan = DIG_PLAN[target];
  let count = CELLS;

  for (const group of shuffled(plan.symmetric ? PAIRS : SINGLES, rng)) {
    if (count - group.length < plan.minGivens) continue;
    const removed = group.map((index) => givens[index]!);
    for (const index of group) givens[index] = 0;
    if (solvableWithin(givens, target)) {
      count -= group.length;
      continue;
    }
    group.forEach((index, k) => (givens[index] = removed[k]!));
  }
  return { givens, solution };
}

/**
 * A puzzle of the requested difficulty, derived entirely from the seed (§7).
 *
 * A dug board ships when it keeps the tier's floor, the tier's techniques
 * finish it, and an independent backtracking count finds exactly one
 * solution. The first two hold by construction and the third follows from
 * them (the techniques are sound); all three are checked anyway. A board that
 * failed would be rebuilt from a derived seed, and a run that exhausted
 * `attemptLimit` seeds throws (§7 step 5) — a broken generator is surfaced
 * rather than handing the player an unfair board. `attemptLimit` exists so a
 * test can reach that branch; the game always uses ATTEMPT_LIMIT.
 */
export function generatePuzzle(
  seed: string,
  difficulty: Difficulty,
  attemptLimit: number = ATTEMPT_LIMIT,
): GeneratedPuzzle {
  const workBefore = solverWork.read();
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    const board = digBoard(attempt === 1 ? seed : `${seed}#${attempt}`, difficulty);
    const tier = gradeTier(board.givens);
    const fair =
      tier !== null &&
      givensCount(board.givens) >= DIG_PLAN[difficulty].minGivens &&
      solvableWithin(board.givens, difficulty) &&
      countSolutions(board.givens, 2) === 1;
    if (fair) {
      return {
        seed,
        difficulty,
        givens: board.givens,
        solution: board.solution,
        tier,
        attempts: attempt,
        work: solverWork.read() - workBefore,
      };
    }
  }
  throw new Error(
    `sudoku-6x6: no fair ${difficulty} board after ${attemptLimit} seeds for ${seed}`,
  );
}

/** Row-major string form ('.' for empty), for golden tests and saves. */
export function gridToString(grid: Grid): string {
  let out = '';
  for (let i = 0; i < CELLS; i++) {
    const value = grid[i] ?? 0;
    out += value === 0 ? '.' : String(value);
  }
  return out;
}

/** Parses the 36-character form. Returns null when malformed. */
export function gridFromString(text: string): Grid | null {
  if (text.length !== CELLS) return null;
  const grid: number[] = [];
  for (const character of text) {
    if (character === '.') {
      grid.push(0);
      continue;
    }
    const value = character.charCodeAt(0) - 48;
    if (value < 1 || value > SIZE) return null;
    grid.push(value);
  }
  return grid;
}
