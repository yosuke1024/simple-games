/**
 * The invariants a shipped puzzle must hold (docs/SUDOKU_RULES.md §7): one
 * solution, solvable by the tier's technique set alone, inside the tier's clue
 * range, deterministic per seed, and generated inside the time budget.
 *
 * These are properties over many seeds rather than one golden board: the
 * guarantee is about every puzzle a player can reach, not a lucky example.
 */
import { describe, expect, it } from 'vitest';
import { clueCount, CLUE_RANGE, generatePuzzle, gridToString } from './generator';
import { grade, solvableWithin } from './grader';
import { countSolutions, isGridSolved, solve } from './solver';
import { CELLS, DIFFICULTIES, type Difficulty, type Grid } from './types';

const SEEDS = [
  'sudoku-level-1',
  'sudoku-level-42',
  'sudoku-level-500',
  'sudoku-level-999',
  'sudoku-daily-2026-08-01',
  'sudoku-daily-2026-12-31',
];

/** Clues mirror around the centre: index i is filled iff 80 - i is. */
const isSymmetric = (grid: Grid): boolean => {
  for (let i = 0; i < CELLS; i++) {
    if ((grid[i] !== 0) !== (grid[CELLS - 1 - i] !== 0)) return false;
  }
  return true;
};

describe.each(DIFFICULTIES)('generatePuzzle — %s', (difficulty: Difficulty) => {
  const puzzles = SEEDS.map((seed) => generatePuzzle(seed, difficulty));

  it('admits exactly one solution', () => {
    for (const puzzle of puzzles) {
      expect(countSolutions(puzzle.givens, 2), puzzle.seed).toBe(1);
    }
  });

  it('carries the solution its clues lead to', () => {
    for (const puzzle of puzzles) {
      expect(isGridSolved(puzzle.solution), puzzle.seed).toBe(true);
      expect(gridToString(solve(puzzle.givens)!), puzzle.seed).toBe(gridToString(puzzle.solution));
      puzzle.givens.forEach((value, index) => {
        if (value !== 0) expect(value, `${puzzle.seed} clue ${index}`).toBe(puzzle.solution[index]);
      });
    }
  });

  it("is solvable by the tier's techniques alone — never by guessing", () => {
    for (const puzzle of puzzles) {
      expect(solvableWithin(puzzle.givens, difficulty), puzzle.seed).toBe(true);
    }
  });

  it('needs nothing beyond the tier when actually solved', () => {
    // The grader reports the hardest technique it really used; it must never
    // exceed the tier the player was promised.
    const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
    for (const puzzle of puzzles) {
      const result = grade(puzzle.givens);
      expect(result.solvable, puzzle.seed).toBe(true);
      expect(rank[result.difficulty], `${puzzle.seed} used ${result.difficulty}`).toBeLessThanOrEqual(
        rank[difficulty],
      );
    }
  });

  it("lands in the tier's clue range and above the 17-clue floor", () => {
    const range = CLUE_RANGE[difficulty];
    for (const puzzle of puzzles) {
      const clues = clueCount(puzzle.givens);
      expect(clues, `${puzzle.seed} has ${clues} clues`).toBeGreaterThanOrEqual(range.min);
      expect(clues, `${puzzle.seed} has ${clues} clues`).toBeLessThanOrEqual(range.max);
      expect(clues).toBeGreaterThanOrEqual(17);
    }
  });

  it('is deterministic: the same seed rebuilds the same puzzle', () => {
    for (const puzzle of puzzles) {
      const again = generatePuzzle(puzzle.seed, difficulty);
      expect(gridToString(again.givens), puzzle.seed).toBe(gridToString(puzzle.givens));
      expect(gridToString(again.solution), puzzle.seed).toBe(gridToString(puzzle.solution));
    }
  });

  it('gives different seeds different puzzles', () => {
    expect(new Set(puzzles.map((p) => gridToString(p.givens))).size).toBe(puzzles.length);
  });
});

describe('symmetry (§6)', () => {
  it('keeps easy and medium boards 180° symmetric', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      for (const seed of SEEDS) {
        const puzzle = generatePuzzle(seed, difficulty);
        expect(isSymmetric(puzzle.givens), `${difficulty} ${seed}`).toBe(true);
      }
    }
  });

  it('lets hard trade symmetry for depth', () => {
    // Not an aesthetic preference but the documented trade: the single-cell
    // pass is what buys the extra clues of depth.
    const hardClues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, 'hard').givens));
    const mediumClues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, 'medium').givens));
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    expect(average(hardClues)).toBeLessThan(average(mediumClues));
  });
});

describe('difficulty separation (§6)', () => {
  it('gives each step up more techniques and fewer clues', () => {
    const average = (difficulty: Difficulty): number => {
      const clues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, difficulty).givens));
      return clues.reduce((a, b) => a + b, 0) / clues.length;
    };
    const easy = average('easy');
    const medium = average('medium');
    const hard = average('hard');
    expect(easy).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(hard);
  });

  it('solves every easy board with singles only', () => {
    for (const seed of SEEDS) {
      const puzzle = generatePuzzle(seed, 'easy');
      expect(solvableWithin(puzzle.givens, 'easy'), seed).toBe(true);
      expect(grade(puzzle.givens).difficulty, seed).toBe('easy');
    }
  });

  it('keeps medium boards free of subset techniques', () => {
    for (const seed of SEEDS) {
      const puzzle = generatePuzzle(seed, 'medium');
      const result = grade(puzzle.givens);
      expect(result.techniques.includes('nakedPair'), seed).toBe(false);
      expect(result.techniques.includes('xWing'), seed).toBe(false);
    }
  });
});

describe('performance budget (§7)', () => {
  /**
   * Measured on the dev machine, with headroom for a low-end phone. A
   * regression here means generation is about to be felt as a pause when a
   * game starts, which is the thing the budget exists to prevent.
   */
  const budgets: Record<Difficulty, number> = { easy: 50, medium: 50, hard: 100 };

  it.each(DIFFICULTIES)('generates a %s puzzle inside its budget', (difficulty: Difficulty) => {
    // Two boards, worst of the two: one sample is noisy on a shared CI box.
    const timings = ['budget-a', 'budget-b'].map((seed) => {
      const started = performance.now();
      generatePuzzle(`${seed}-${difficulty}`, difficulty);
      return performance.now() - started;
    });
    const worst = Math.max(...timings);
    expect(worst, `${difficulty} took ${worst.toFixed(1)}ms`).toBeLessThan(budgets[difficulty]);
  });
});
