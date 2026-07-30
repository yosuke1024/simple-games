/**
 * Board generation — implements docs/NONOGRAM_RULES.md §5.
 *
 * A candidate is random paint at the target fill rate; the line solver (§4) is
 * the gate. Only a board the solver finishes from an empty grid is accepted,
 * so every shipped puzzle is solvable line by line with a unique solution.
 * A rejected candidate costs one derived seed and another try — the same
 * pattern Minesweeper uses for its no-guess guarantee.
 */
import { computeClues, emptyMarks, type Clues } from './engine';
import { createRng } from './rng';
import { solve } from './solver';
import { EMPTY, PAINTED, cellCount, type Cell, type Size } from './types';

/** Attempt cap (§5). The fallback beyond it is monitored by tests, not hoped at. */
export const ATTEMPT_LIMIT = 200;

export interface GeneratedPuzzle {
  readonly size: Size;
  readonly solution: readonly Cell[];
  readonly clues: Clues;
  /** How many candidates were drawn — 1 means the first was line-solvable. */
  readonly attempts: number;
  /** True when the cap was hit and the last candidate shipped anyway (§5). */
  readonly fallback: boolean;
}

function candidate(seed: string, size: Size, fillRate: number): Cell[] {
  const rng = createRng(seed);
  const cells: Cell[] = [];
  for (let i = 0; i < cellCount(size); i++) cells.push(rng() < fillRate ? PAINTED : EMPTY);
  return cells;
}

/**
 * The same seed always returns the same puzzle (§5): the retry loop derives
 * `<seed>#2`, `<seed>#3`, … deterministically, so the accepted candidate is a
 * pure function of the seed alone.
 */
export function generatePuzzle(seed: string, size: Size, fillRate: number): GeneratedPuzzle {
  let solution: Cell[] = [];
  let clues: Clues = { rows: [], cols: [] };
  for (let attempt = 1; attempt <= ATTEMPT_LIMIT; attempt++) {
    solution = candidate(attempt === 1 ? seed : `${seed}#${attempt}`, size, fillRate);
    clues = computeClues(solution, size);
    const result = solve(emptyMarks(size), clues.rows, clues.cols, size);
    if (result.solved) return { size, solution, clues, attempts: attempt, fallback: false };
  }
  // Still winnable — the win compares runs to clues, not to this solution (§2).
  return { size, solution, clues, attempts: ATTEMPT_LIMIT, fallback: true };
}
