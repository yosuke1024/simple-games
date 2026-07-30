/**
 * The no-guess guarantee at scale (docs/MINESWEEPER_RULES.md §4, §5).
 *
 * generator.test.ts checks the rules on a handful of boards. This one exists so
 * the guarantee is a measured property rather than a claim: it generates every
 * difficulty many times over, from many different first taps, and asserts that
 * not one board fell back to the "best attempt" branch.
 *
 * It also prints the cost, because the guarantee is only worth having if it is
 * affordable — a board the player waits for is a board that should have been
 * dealt differently. The numbers land in CI output where anyone quoting them
 * can check them.
 */
import { describe, expect, it } from 'vitest';
import { generateField } from './generator';
import { PRESETS, type Difficulty } from './types';

/** Enough boards to catch a rare fallback; small enough to stay in CI. */
const SAMPLE = 500;

/** Per-board budgets from §5, with headroom for a low-end phone. */
const BUDGET_MS: Record<Difficulty, number> = { easy: 50, medium: 50, hard: 200 };

describe.each(['easy', 'medium', 'hard'] as Difficulty[])(
  'no-guess generation — %s',
  (difficulty: Difficulty) => {
    const preset = PRESETS[difficulty];
    const cells = preset.width * preset.height;

    const results = Array.from({ length: SAMPLE }, (_, i) => {
      // A stride that is coprime with the cell count walks the whole board, so
      // corners and edges — where the opening is smallest and the generator
      // works hardest — are all represented.
      const firstIndex = (i * 37) % cells;
      const started = performance.now();
      const field = generateField(`guarantee-${difficulty}-${i}`, difficulty, firstIndex);
      return { field, firstIndex, ms: performance.now() - started };
    });

    it('never falls back: every board is solvable without guessing', () => {
      const fell = results.filter((r) => !r.field.noGuess);
      expect(fell.map((r) => r.firstIndex)).toEqual([]);
    });

    it('keeps the first tap and its neighbours clear of mines', () => {
      for (const { field, firstIndex } of results) {
        expect(field.field.mines[firstIndex], `first tap ${firstIndex}`).toBe(false);
      }
    });

    it('places exactly the preset mine count', () => {
      for (const { field } of results) {
        expect(field.field.mines.filter(Boolean)).toHaveLength(preset.mines);
      }
    });

    it('generates inside the budget', () => {
      const times = results.map((r) => r.ms).sort((a, b) => a - b);
      const mean = times.reduce((a, b) => a + b, 0) / times.length;
      const at = (q: number) => times[Math.floor(times.length * q)]!;
      const attempts = results.map((r) => r.field.attempts);
      // Printed so the figures quoted in docs and reviews are reproducible.
      console.log(
        `[minesweeper ${difficulty}] n=${SAMPLE} mean=${mean.toFixed(2)}ms ` +
          `p50=${at(0.5).toFixed(2)} p90=${at(0.9).toFixed(2)} p99=${at(0.99).toFixed(2)} ` +
          `max=${times[times.length - 1]!.toFixed(2)} ` +
          `attempts mean=${(attempts.reduce((a, b) => a + b, 0) / attempts.length).toFixed(1)} ` +
          `max=${Math.max(...attempts)}`,
      );
      expect(mean, `${difficulty} mean ${mean.toFixed(2)}ms`).toBeLessThan(BUDGET_MS[difficulty]);
      expect(
        times[times.length - 1]!,
        `${difficulty} worst ${times[times.length - 1]!.toFixed(2)}ms`,
      ).toBeLessThan(BUDGET_MS[difficulty]);
    });
  },
);
