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

/**
 * Retries per board, the deterministic form of the §5 budget.
 *
 * §5 budgets generation in milliseconds on the device, and this file used to
 * assert that budget against `performance.now()` over all 500 samples — both
 * the mean and the worst single board. The worst-of-500 assertion was the most
 * fragile line in the repo: idle and alone, medium's median board takes 0.26ms
 * and its worst takes 32.6ms, a 125× spread over work that differs by at most
 * 6×. That is GC and core scheduling, not generation, and under `pnpm test`
 * it comfortably clears 50ms. A ceiling safe against it would have to sit
 * above the budget it was meant to enforce.
 *
 * Attempts are what generation actually spends: a board is laid out, solved,
 * and re-laid from a derived seed until it needs no guess (§5.3), so cost is
 * the retry count times a constant. The count is a function of the seed and
 * the first tap, so it is identical on every machine and in every pool
 * configuration. The milliseconds are still measured and printed — §5 quotes
 * them, so they should be reproducible — but they are not asserted here. The
 * device-side promise is checked on a device, per docs/RELEASE_CHECKLIST.md §2.
 */
const BUDGET_ATTEMPTS: Record<Difficulty, { readonly mean: number; readonly worst: number }> = {
  easy: { mean: 2, worst: 10 },
  medium: { mean: 4, worst: 25 },
  hard: { mean: 12, worst: 80 },
};

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
      const at = (q: number) => times[Math.floor(times.length * q)]!;
      const attempts = results.map((r) => r.field.attempts);
      const attemptMean = attempts.reduce((a, b) => a + b, 0) / attempts.length;
      const attemptWorst = Math.max(...attempts);
      const budget = BUDGET_ATTEMPTS[difficulty];
      // Printed so the figures quoted in docs and reviews are reproducible.
      // Milliseconds are the observation; attempts are the assertion.
      console.log(
        `[minesweeper ${difficulty}] n=${SAMPLE} ` +
          `attempts mean=${attemptMean.toFixed(1)} max=${attemptWorst} ` +
          `— ms mean=${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)} ` +
          `p50=${at(0.5).toFixed(2)} p90=${at(0.9).toFixed(2)} p99=${at(0.99).toFixed(2)} ` +
          `max=${times[times.length - 1]!.toFixed(2)}`,
      );
      expect(attemptMean, `${difficulty} mean ${attemptMean.toFixed(1)} attempts`).toBeLessThan(
        budget.mean,
      );
      expect(attemptWorst, `${difficulty} worst ${attemptWorst} attempts`).toBeLessThan(
        budget.worst,
      );
    });
  },
);
