/**
 * The promise of docs/MINESWEEPER_RULES.md §4 and §5, checked as a property
 * over many seeds and all three boards rather than on one lucky example: the
 * first tap is always safe and always opens a region, the board that follows is
 * always finishable by the two rules alone, and the same seed and first tap
 * always rebuild it.
 *
 * This is the file that guards the reason this title exists. If it goes red,
 * the app is shipping boards that can be lost to luck.
 */
import { describe, expect, it } from 'vitest';
import { cellAndNeighbours, openRegion } from './board';
import { generateField, MAX_ATTEMPTS } from './generator';
import { solveFrom } from './solver';
import { cellCount, DIFFICULTIES, mineDensity, PRESETS, type Difficulty } from './types';

const SEEDS = [
  'mines-easy-a1',
  'mines-easy-b2',
  'mines-medium-c3',
  'mines-hard-d4',
  'mines-daily-2026-08-01',
  'mines-daily-2026-12-31',
  'mines-retry-x',
  'mines-retry-y',
];

/**
 * First taps spread over the board, corners included: a corner opens the
 * smallest possible region and is therefore the hardest start to satisfy.
 */
function firstTaps(difficulty: Difficulty): number[] {
  const preset = PRESETS[difficulty];
  const cells = cellCount(preset);
  return [
    0,
    preset.width - 1,
    cells - preset.width,
    cells - 1,
    Math.floor(cells / 2),
    Math.floor(preset.height / 3) * preset.width + 2,
  ];
}

/** Every (seed, first tap) pair a difficulty is measured over. */
function boardsFor(difficulty: Difficulty) {
  const taps = firstTaps(difficulty);
  return SEEDS.flatMap((seed, index) =>
    taps.map((first) => ({
      seed,
      first,
      label: `${difficulty} ${seed} @${first}`,
      result: generateField(`${seed}-${index}`, difficulty, first),
      attemptSeed: `${seed}-${index}`,
    })),
  );
}

describe.each(DIFFICULTIES)('generateField — %s', (difficulty: Difficulty) => {
  const preset = PRESETS[difficulty];
  const boards = boardsFor(difficulty);

  it('lays exactly the mines the preset promises (§1)', () => {
    for (const { label, result } of boards) {
      const mines = result.field.mines.filter(Boolean).length;
      expect(mines, label).toBe(preset.mines);
      expect(result.field.mines.length, label).toBe(cellCount(preset));
      expect(result.field.width, label).toBe(preset.width);
      expect(result.field.height, label).toBe(preset.height);
    }
  });

  it('keeps the first tap and all eight neighbours clear, and opens a region (§4)', () => {
    for (const { label, first, result } of boards) {
      const around = cellAndNeighbours(preset.width, preset.height, first);
      for (const cell of around) {
        expect(result.field.mines[cell], `${label} has a mine at ${cell}`).toBe(false);
      }
      // Clear neighbours means the tapped cell reads 0, which means flood fill.
      expect(result.field.counts[first], label).toBe(0);

      const opened = new Array<boolean>(cellCount(preset)).fill(false);
      const region = openRegion(result.field, first, opened);
      expect(region, `${label} opened only ${region} cells`).toBeGreaterThanOrEqual(around.length);
    }
  });

  it('is finishable by the two rules alone — no guess anywhere (§4, §5)', () => {
    for (const { label, first, result } of boards) {
      expect(result.noGuess, `${label} fell back to a guessable layout`).toBe(true);
      const outcome = solveFrom(result.field, first);
      expect(outcome.solved, `${label} left ${outcome.remaining} cells unprovable`).toBe(true);
      expect(outcome.remaining, label).toBe(0);
    }
  });

  it('rebuilds the identical board from the same seed and first tap (§5)', () => {
    for (const { label, first, attemptSeed, result } of boards) {
      const again = generateField(attemptSeed, difficulty, first);
      expect(again.field.mines, label).toEqual(result.field.mines);
      expect(again.attempts, label).toBe(result.attempts);
    }
  });

  it('gives different seeds, and different first taps, different boards', () => {
    const taps = firstTaps(difficulty);
    const byTap = taps.map((first) =>
      generateField('mines-distinct', difficulty, first).field.mines.join(''),
    );
    expect(new Set(byTap).size, 'first taps').toBe(byTap.length);

    const bySeed = SEEDS.map((seed) =>
      generateField(seed, difficulty, taps[4]!).field.mines.join(''),
    );
    expect(new Set(bySeed).size, 'seeds').toBe(bySeed.length);
  });

  /**
   * Retries observed on the dev machine over 400 boards per difficulty:
   * easy mean 1.2 (max 4), medium mean 2.4 (max 11), hard mean 7.5 (max 41).
   * The ceilings below sit at roughly three times the measured mean, so this
   * catches a real regression in how often a layout is thrown away without
   * failing on ordinary run-to-run noise.
   */
  it('accepts a layout within the expected number of retries (§5)', () => {
    const ceiling: Record<Difficulty, number> = { easy: 4, medium: 8, hard: 25 };
    const attempts = boards.map((board) => board.result.attempts);
    const mean = attempts.reduce((a, b) => a + b, 0) / attempts.length;
    const worst = Math.max(...attempts);
    expect(
      mean,
      `${difficulty}: mean ${mean.toFixed(1)} attempts, worst ${worst}, cap ${MAX_ATTEMPTS}`,
    ).toBeLessThanOrEqual(ceiling[difficulty]);
    expect(worst, `${difficulty} worst was ${worst}`).toBeLessThan(MAX_ATTEMPTS);
  });
});

describe('the presets themselves (§1)', () => {
  it('matches the published table', () => {
    expect(PRESETS.easy).toEqual({ width: 9, height: 9, mines: 10 });
    expect(PRESETS.medium).toEqual({ width: 12, height: 12, mines: 25 });
    expect(PRESETS.hard).toEqual({ width: 14, height: 18, mines: 50 });
  });

  it('keeps the densities the table quotes, and keeps them rising', () => {
    expect(mineDensity(PRESETS.easy)).toBeCloseTo(0.123, 3);
    expect(mineDensity(PRESETS.medium)).toBeCloseTo(0.174, 3);
    expect(mineDensity(PRESETS.hard)).toBeCloseTo(0.198, 3);
  });

  it('stays narrower than the original expert board (§13)', () => {
    // Difficulty comes from density, not from a board too wide for a thumb.
    for (const difficulty of DIFFICULTIES) {
      expect(PRESETS[difficulty].width, difficulty).toBeLessThanOrEqual(14);
    }
  });
});

describe('performance budget (§5)', () => {
  /**
   * Easy and medium under 50ms, hard under 200ms — the numbers §5 gives, on the
   * device, from the first tap. Measured on the dev machine the worst of three
   * boards lands around 1ms for easy and medium and around 6ms for hard, so
   * this has room for a low-end phone and for a noisy CI box.
   */
  const budget: Record<Difficulty, number> = { easy: 50, medium: 50, hard: 200 };

  it.each(DIFFICULTIES)('generates a %s board inside its budget', (difficulty: Difficulty) => {
    const taps = firstTaps(difficulty);
    const timings = ['budget-a', 'budget-b', 'budget-c'].map((seed, index) => {
      const started = performance.now();
      generateField(`${seed}-${difficulty}`, difficulty, taps[index]!);
      return performance.now() - started;
    });
    const worst = Math.max(...timings);
    expect(
      worst,
      `${difficulty} took ${timings.map((t) => t.toFixed(1)).join('/')}ms, budget ${budget[difficulty]}ms`,
    ).toBeLessThan(budget[difficulty]);
  });
});
