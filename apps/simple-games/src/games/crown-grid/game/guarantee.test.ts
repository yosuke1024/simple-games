/**
 * The promises of docs/CROWN_GRID_RULES.md §7 and §8, measured rather than
 * assumed: every puzzle that ships has exactly one answer, no region smaller
 * than MIN_REGION_SIZE, grades at the tier it was asked for, is settled by
 * that tier's techniques alone, generation is deterministic, the fallback
 * stays theoretical — and, driven on purpose with a tiny attempt limit, ships
 * what §8 says it ships — and the work stays inside its budget.
 *
 * Forty fixed seeds per tier and two years of dailies. The figure is not
 * decorative: the budgets below are stated against "the worst of two years of
 * dailies", and a gate that walked two months while the claim said two years
 * would leave 670 days of fallback, retry and work regressions unguarded
 * behind a promise. The whole walk costs a few seconds.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed } from './daily';
import { marksOf, isSolved } from './engine';
import { ATTEMPT_LIMIT, generatePuzzle, MIN_REGION_SIZE, type GeneratedPuzzle } from './generator';
import {
  buildLayout,
  countSolutions,
  crownsOf,
  initialState,
  solve,
  TIER_TECHNIQUES,
} from './solver';
import { DIFFICULTIES, type Difficulty } from './types';

/**
 * Solver steps one board may cost (`solverWork`, and the reason it is counted
 * at all is in that comment). Measured on this list: the worst Hard board is
 * well under a million steps and the worst daily far below that, so the
 * budget sits at more than twice the worst case. It is a regression gate, not
 * a device promise — the device promise is checked on a device, per
 * docs/RELEASE_CHECKLIST.md §2 — and what it catches is a technique loop that
 * stops escalating cheapest-first, a repair that stops converging, or a
 * counting search that lost its pruning.
 */
const WORK_BUDGET = 2_000_000;

/**
 * Derived seeds one board may cost (§8). Far below ATTEMPT_LIMIT, so a tier
 * drifting up to here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 160;

const SEEDS_PER_TIER = 40;
const DAILY_DAYS = 730;

interface Run {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

/** Built once: every describe reads the same walk rather than repeating it. */
function walk(): Run[] {
  const runs: Run[] = [];
  const time = (name: string, difficulty: Difficulty, seed: string): void => {
    const started = performance.now();
    const puzzle = generatePuzzle(seed, difficulty);
    runs.push({ name, difficulty, puzzle, ms: performance.now() - started });
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      time(`${difficulty} #${n}`, difficulty, `crown-grid-${difficulty}-walk-${n}`);
    }
  }
  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    time(`daily ${date}`, DAILY_DIFFICULTY, dailySeed(date));
    date = addDays(date, 1);
  }
  return runs;
}

const runs = walk();

describe('unique, tier-true generation (§7, §8)', () => {
  it('ships exactly one answer on every board, and it is the intended one', () => {
    for (const { name, puzzle } of runs) {
      expect(countSolutions(puzzle.regions, puzzle.size, 2), `${name} is not unique`).toBe(1);
      expect(
        isSolved(marksOf(puzzle.solution, puzzle.size), puzzle.regions, puzzle.size),
        `${name}'s answer breaks a rule`,
      ).toBe(true);
    }
  });

  it('never hands over a crown: no region is smaller than the floor', () => {
    for (const { name, puzzle } of runs) {
      const sizes = new Array<number>(puzzle.size).fill(0);
      for (const region of puzzle.regions) sizes[region]!++;
      expect(
        Math.min(...sizes),
        `${name} has a region of ${Math.min(...sizes)}`,
      ).toBeGreaterThanOrEqual(MIN_REGION_SIZE);
    }
  });

  it("is settled by the tier's own techniques, and lands on the answer", () => {
    for (const { name, difficulty, puzzle } of runs) {
      const state = initialState(buildLayout(puzzle.regions, puzzle.size));
      const result = solve(state, TIER_TECHNIQUES[difficulty]);
      expect(result.contradiction, `${name} contradicts itself`).toBeNull();
      expect(result.solved, `${name} needs more than its tier`).toBe(true);
      const expected = puzzle.solution.map((col, row) => row * puzzle.size + col);
      expect(crownsOf(state), `${name} settles on a different board`).toEqual(expected);
    }
  });

  it('is not settled by the tier below (Medium and Hard are earned)', () => {
    for (const { name, difficulty, puzzle } of runs) {
      if (difficulty === 'easy') continue;
      const below: Difficulty = difficulty === 'hard' ? 'medium' : 'easy';
      const state = initialState(buildLayout(puzzle.regions, puzzle.size));
      expect(solve(state, TIER_TECHNIQUES[below]).solved, `${name} is only ${below}`).toBe(false);
    }
  });

  it('never falls back: every board grades at the tier it asked for', () => {
    for (const { name, difficulty, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.tier, `${name} shipped at another tier`).toBe(difficulty);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('crown-grid-repeat', 'medium');
    const b = generatePuzzle('crown-grid-repeat', 'medium');
    expect(a.regions).toEqual(b.regions);
    expect(a.solution).toEqual(b.solution);
    expect(a.attempts).toBe(b.attempts);
    expect(a.work).toBe(b.work);
    // And a walked seed is a pure function of itself, walk or no walk.
    const again = generatePuzzle('crown-grid-hard-walk-7', 'hard');
    expect(again.regions).toEqual([...runs.find((run) => run.name === 'hard #7')!.puzzle.regions]);
  });
});

/**
 * §8 step 5, which no walked seed reaches: the limit is the one seam into it.
 * The seeds are chosen for what their first derived seeds happen to grade at,
 * so each case below is the fallback choosing between known candidates.
 */
describe('the fallback (§8 step 5)', () => {
  const checkShippable = (puzzle: GeneratedPuzzle): void => {
    expect(countSolutions(puzzle.regions, puzzle.size, 2)).toBe(1);
    expect(isSolved(marksOf(puzzle.solution, puzzle.size), puzzle.regions, puzzle.size)).toBe(true);
    const state = initialState(buildLayout(puzzle.regions, puzzle.size));
    expect(solve(state, TIER_TECHNIQUES[puzzle.tier]).solved).toBe(true);
    const sizes = new Array<number>(puzzle.size).fill(0);
    for (const region of puzzle.regions) sizes[region]!++;
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_REGION_SIZE);
  };

  it('ships the hardest easier board, flagged, with the seeds it really drew', () => {
    // Hard walk-6: the first derived seed grades Easy, nothing better comes up
    // in the second, and the third grades Medium.
    const two = generatePuzzle('crown-grid-hard-walk-6', 'hard', 2);
    expect(two).toMatchObject({ fallback: true, tier: 'easy', attempts: 2, difficulty: 'hard' });
    checkShippable(two);
    const three = generatePuzzle('crown-grid-hard-walk-6', 'hard', 3);
    expect(three).toMatchObject({ fallback: true, tier: 'medium', attempts: 3 });
    checkShippable(three);
  });

  it('ships Easy the nearest harder board, since nothing is easier than Easy', () => {
    // Easy walk-5: the first derived seed grades Hard, the second Medium.
    const one = generatePuzzle('crown-grid-easy-walk-5', 'easy', 1);
    expect(one).toMatchObject({ fallback: true, tier: 'hard', attempts: 1, difficulty: 'easy' });
    checkShippable(one);
    const two = generatePuzzle('crown-grid-easy-walk-5', 'easy', 2);
    expect(two).toMatchObject({ fallback: true, tier: 'medium', attempts: 2 });
    checkShippable(two);
  });

  it('is still a pure function of the seed', () => {
    const a = generatePuzzle('crown-grid-hard-walk-6', 'hard', 3);
    const b = generatePuzzle('crown-grid-hard-walk-6', 'hard', 3);
    expect(a.regions).toEqual(b.regions);
    expect(a.work).toBe(b.work);
  });

  it('throws only when not one unique candidate came up', () => {
    // Medium walk-1's first derived seed yields no unique board a tier finishes.
    expect(() => generatePuzzle('crown-grid-medium-walk-1', 'medium', 1)).toThrow(
      /no unique medium candidate after 1 seeds/,
    );
    expect(() => generatePuzzle('crown-grid-easy-walk-1', 'easy', 0)).toThrow(/after 0 seeds/);
  });
});

/**
 * §8 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted.
 */
describe('generation cost (§8)', () => {
  const percentile = (values: number[], q: number): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  };

  it('stays inside the work budget on every board', () => {
    for (const group of [...DIFFICULTIES, 'daily'] as const) {
      const subset = runs.filter((run) =>
        group === 'daily' ? run.name.startsWith('daily') : run.name.startsWith(group),
      );
      const works = subset.map((run) => run.puzzle.work);
      const attempts = subset.map((run) => run.puzzle.attempts);
      const ms = subset.map((run) => run.ms);
      console.log(
        `[crown-grid ${group}] n=${subset.length} work p50=${percentile(works, 0.5)} ` +
          `p90=${percentile(works, 0.9)} max=${Math.max(...works)} | attempts p50=${percentile(attempts, 0.5)} ` +
          `max=${Math.max(...attempts)} | ms p50=${percentile(ms, 0.5).toFixed(1)} ` +
          `max=${Math.max(...ms).toFixed(1)} (printed, not asserted)`,
      );
    }
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('never approaches the attempt cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
    expect(ATTEMPT_BUDGET).toBeLessThan(ATTEMPT_LIMIT);
  });
});
