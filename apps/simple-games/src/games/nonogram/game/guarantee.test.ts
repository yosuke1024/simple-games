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
import { type Size } from './types';

/** A spread of levels across every band of §6, ends included. */
const SAMPLE_LEVELS = [1, 2, 60, 119, 120, 121, 300, 499, 500, 501, 750, 998, MAX_LEVEL];

describe('no-guess generation (§4, §5)', () => {
  it('ships only line-solvable puzzles, across every band', () => {
    for (const level of SAMPLE_LEVELS) {
      const puzzle = generatePuzzle(levelSeed(level), sizeForLevel(level), fillRateForLevel(level));
      expect(puzzle.fallback, `level ${level} fell back`).toBe(false);
      const result = solve(
        emptyMarks(puzzle.size),
        puzzle.clues.rows,
        puzzle.clues.cols,
        puzzle.size,
      );
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

/**
 * §5 budgets generation in milliseconds on the device. These two cases used to
 * assert that budget against `performance.now()` here, which measures the work
 * times whatever else the machine is doing — under `pnpm test`, six other
 * vitest forks. Nonogram had the widest margin of the three generators and so
 * flaked least, but it was the same broken instrument, and the same fix
 * applies: assert the retries, which are a function of the seed alone and
 * therefore identical on every machine, and print the milliseconds §5 quotes
 * rather than asserting them. The device-side promise is checked on a device,
 * per docs/RELEASE_CHECKLIST.md §2.
 */
describe('generation cost (§5)', () => {
  const measure = (level: number, size: Size) => {
    const started = performance.now();
    const puzzle = generatePuzzle(levelSeed(level), size, fillRateForLevel(level));
    return { level, attempts: puzzle.attempts, ms: performance.now() - started };
  };

  it('builds a 5×5 in a handful of attempts', () => {
    const { attempts, ms } = measure(60, 5);
    console.log(`[nonogram 5×5] level 60 attempts=${attempts} — ms=${ms.toFixed(2)}`);
    expect(attempts, `5×5 took ${attempts} attempts`).toBeLessThan(10);
  });

  it('builds a 10×10 in a handful of attempts, at the loosest fill', () => {
    const rows = [501, 750, MAX_LEVEL].map((level) => measure(level, 10));
    const worst = rows.reduce((a, b) => (b.attempts > a.attempts ? b : a));
    console.log(
      `[nonogram 10×10] ${rows.map((r) => `L${r.level} attempts=${r.attempts} (${r.ms.toFixed(2)}ms)`).join(' ')}`,
    );
    expect(
      worst.attempts,
      `10×10 worst ${worst.attempts} attempts at level ${worst.level}`,
    ).toBeLessThan(ATTEMPT_LIMIT / 4);
  });
});
