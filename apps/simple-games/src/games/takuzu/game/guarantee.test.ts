/**
 * The promises of docs/TAKUZU_RULES.md §5–§7, measured rather than assumed:
 * every puzzle that ships is settled by the three techniques alone — which is
 * both "no guessing" and "exactly one solution" — generation is deterministic,
 * the fallback stays theoretical, and the work stays inside its budget.
 *
 * The whole list is walked, not a sample. There are 100 levels and the walk
 * costs under a second, so sampling would only buy the chance of shipping the
 * one level that is broken.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_GIVENS_RATIO, DAILY_SIZE, addDays, dailySeed } from './daily';
import { ATTEMPT_LIMIT, generatePuzzle, type GeneratedPuzzle } from './generator';
import { givensRatioForLevel, levelSeed, MAX_LEVEL, sizeForLevel } from './levels';
import { solve } from './solver';
import { cellCount } from './types';

/**
 * Lines the solver may read to build one board (`solverWork`, and the reason
 * it is counted at all is in that comment). Measured on this list: the worst
 * level is 98 at 33,585 and the worst of two years of dailies is 14,972, so
 * the budget sits at roughly 1.8× the worst case. It is a regression gate, not
 * a device promise — the device promise is checked on a device, per
 * docs/RELEASE_CHECKLIST.md §2 — and what it catches is a technique loop that
 * stops escalating cheapest-first, or a dig that starts re-solving lines it
 * has already settled.
 */
const WORK_BUDGET = 60_000;

/**
 * Derived seeds one board may cost (§6). Measured: 91 of the 100 levels land
 * on the first solution board they are given, 8 need a second and level 63
 * needs five; every daily across two years lands on the first. The cap is
 * ATTEMPT_LIMIT and this budget is far below it, so a level drifting up to
 * here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 8;

/** 60 days is two months of daily seeds — enough to see a bad day coming. */
const DAILY_DAYS = 60;

interface Run {
  readonly name: string;
  /** The givens the band asked for — what "fell back" is measured against. */
  readonly target: number;
  readonly puzzle: GeneratedPuzzle;
}

/** Built once: both describes read the same walk rather than repeating it. */
function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];

  for (let level = 1; level <= MAX_LEVEL; level++) {
    const size = sizeForLevel(level);
    const ratio = givensRatioForLevel(level);
    runs.push({
      name: `level ${level}`,
      target: Math.round(cellCount(size) * ratio),
      puzzle: generatePuzzle(levelSeed(level), size, ratio),
    });
  }

  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push({
      name: `daily ${date}`,
      target: Math.round(cellCount(DAILY_SIZE) * DAILY_GIVENS_RATIO),
      puzzle: generatePuzzle(dailySeed(date), DAILY_SIZE, DAILY_GIVENS_RATIO),
    });
    date = addDays(date, 1);
  }

  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();

describe('no-guess generation (§5, §6)', () => {
  it('settles every level and daily with the techniques alone', () => {
    for (const { name, puzzle } of runs) {
      const result = solve(puzzle.givens, puzzle.size);
      expect(result.contradiction, `${name} contradicts itself`).toBe(false);
      expect(result.solved, `${name} needs a guess`).toBe(true);
      // The board the techniques reach is the board that was dug from, so the
      // puzzle has exactly one solution — anything else would need the solver
      // to have written a digit the generator did not.
      expect(result.board, `${name} settles on a different board`).toEqual([...puzzle.solution]);
    }
  });

  it('never falls back to a board easier than its band asked for', () => {
    for (const { name, target, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.givensCount, `${name} kept too many givens`).toBeLessThanOrEqual(target);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('takuzu-repeat', 8, 0.4);
    const b = generatePuzzle('takuzu-repeat', 8, 0.4);
    expect(a.solution).toEqual(b.solution);
    expect(a.givens).toEqual(b.givens);
    expect(a.attempts).toBe(b.attempts);
    // And a level is a pure function of its number, walk or no walk.
    const again = generatePuzzle(levelSeed(37), sizeForLevel(37), givensRatioForLevel(37));
    expect(again.givens).toEqual([...runs[36]!.puzzle.givens]);
  });
});

/**
 * §6 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, six other vitest forks — so the gate is the
 * work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted. The
 * reasoning, and the 41× spread that produced it, is in SUDOKU_RULES.md §7.
 */
describe('generation cost (§6)', () => {
  it('stays inside the work budget on every board', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    const total = runs.reduce((sum, run) => sum + run.puzzle.work, 0);
    console.log(
      `[takuzu] ${runs.length} boards: worst work=${worst.puzzle.work} (${worst.name}) ` +
        `total=${total} — ms=${ms.toFixed(0)} (printed, not asserted)`,
    );
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('rarely needs a second solution board, and never approaches the cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    const retried = runs.filter((run) => run.puzzle.attempts > 1).length;
    console.log(
      `[takuzu] ${retried}/${runs.length} boards needed a derived seed; ` +
        `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
    );
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
  });
});
