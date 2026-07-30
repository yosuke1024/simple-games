/**
 * The promises of docs/NONOGRAM_RULES.md §4–§6, measured rather than assumed:
 * every shipped puzzle is line-solvable from an empty grid, generation is
 * deterministic, the fallback stays theoretical, and the budget holds.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_FILL_RATE, DAILY_SIZE, dailySeed } from './daily';
import { emptyMarks } from './engine';
import { ATTEMPT_LIMIT, generatePuzzle } from './generator';
import { fillRateForLevel, levelSeed, MAX_LEVEL, sizeForLevel } from './levels';
import { solve } from './solver';

/** A spread of levels across every band of §6, ends included. */
const SAMPLE_LEVELS = [1, 2, 60, 119, 120, 121, 300, 499, 500, 501, 750, 998, MAX_LEVEL];

describe('no-guess generation (§4, §5)', () => {
  it('ships only line-solvable puzzles, across every band', () => {
    for (const level of SAMPLE_LEVELS) {
      const puzzle = generatePuzzle(levelSeed(level), sizeForLevel(level), fillRateForLevel(level));
      expect(puzzle.fallback, `level ${level} fell back`).toBe(false);
      const result = solve(emptyMarks(puzzle.size), puzzle.clues.rows, puzzle.clues.cols, puzzle.size);
      expect(result.solved, `level ${level} is not line-solvable`).toBe(true);
      // The unique solution the solver reaches is the generated one.
      result.marks.forEach((mark, i) => {
        expect(mark === 1 ? 1 : 0).toBe(puzzle.solution[i]);
      });
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('nono-repeat', 10, 0.55);
    const b = generatePuzzle('nono-repeat', 10, 0.55);
    expect(a.solution).toEqual(b.solution);
    expect(a.attempts).toBe(b.attempts);
  });

  it('solves a month of dailies without a fallback', () => {
    for (let day = 1; day <= 30; day++) {
      const seed = dailySeed(`2026-08-${String(day).padStart(2, '0')}`);
      const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_FILL_RATE);
      expect(puzzle.fallback, `daily ${seed} fell back`).toBe(false);
    }
  });

  it('stays far from the attempt cap (§5 monitors, not hopes)', () => {
    let worst = 0;
    for (const level of SAMPLE_LEVELS) {
      const puzzle = generatePuzzle(levelSeed(level), sizeForLevel(level), fillRateForLevel(level));
      worst = Math.max(worst, puzzle.attempts);
    }
    expect(worst, `worst attempts ${worst}`).toBeLessThan(ATTEMPT_LIMIT / 4);
  });
});

describe('performance budget (§5)', () => {
  it('generates a 5×5 inside its budget', () => {
    const start = performance.now();
    generatePuzzle(levelSeed(60), 5, fillRateForLevel(60));
    const took = performance.now() - start;
    expect(took, `5×5 took ${took.toFixed(1)}ms`).toBeLessThan(50);
  });

  it('generates a 10×10 inside its budget, at the loosest fill', () => {
    let worst = 0;
    for (const level of [501, 750, MAX_LEVEL]) {
      const start = performance.now();
      generatePuzzle(levelSeed(level), 10, fillRateForLevel(level));
      worst = Math.max(worst, performance.now() - start);
    }
    expect(worst, `10×10 worst ${worst.toFixed(1)}ms`).toBeLessThan(200);
  });
});
