/**
 * The promises of docs/SUDOKU_6X6_RULES.md §6 and §7, measured rather than
 * assumed: every board that ships has exactly one answer, is finished by its
 * tier's techniques alone, keeps its tier's floor (and symmetry, where the
 * tier has it), is a pure function of its seed — and costs no more work than
 * the budget below.
 *
 * Forty fixed seeds per tier and two years of dailies — the same walk the
 * table in §7 was measured on. The tier distribution each group actually
 * needs is printed alongside the work: §6 promises the technique set a tier
 * allows, not that its hardest technique is needed, and the print is where
 * that stays visible.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed } from './daily';
import { DIG_PLAN, generatePuzzle, givensCount, type GeneratedPuzzle } from './generator';
import { gradeTier, solvableWithin, TIER_RANK } from './grader';
import { countSolutions, isGridSolved } from './solver';
import { CELLS, DIFFICULTIES, type Difficulty, type Grid } from './types';

/**
 * `solverWork` one board may cost. Measured on this walk: the worst board of
 * any group is 4,677 (Hard); the gate sits at about 2.6× that. It is a
 * regression gate, not a device promise — the device promise is checked on a
 * device (docs/RELEASE_CHECKLIST.md §2) — and what it catches is a dig that
 * stops being one pass, a grader that stops escalating cheapest-first, or a
 * search that lost its pruning.
 */
const WORK_BUDGET = 12_000;

/**
 * Seeds one board may draw, the original included. Every walked board ships
 * on its first seed (§7: derived seeds are a defence), so one is the gate.
 */
const ATTEMPT_BUDGET = 1;

const SEEDS_PER_TIER = 40;
const DAILY_DAYS = 730;

interface Run {
  readonly group: Difficulty | 'daily';
  readonly name: string;
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

function walk(): Run[] {
  const runs: Run[] = [];
  const time = (group: Run['group'], name: string, difficulty: Difficulty, seed: string) => {
    const started = performance.now();
    const puzzle = generatePuzzle(seed, difficulty);
    runs.push({ group, name, puzzle, ms: performance.now() - started });
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      time(difficulty, `${difficulty} g${n}`, difficulty, `sudoku-6x6-${difficulty}-g${n}`);
    }
  }
  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    time('daily', `daily ${date}`, DAILY_DIFFICULTY, dailySeed(date));
    date = addDays(date, 1);
  }
  return runs;
}

const runs = walk();

/** Clues mirror around the centre: index i is a clue iff 35 - i is. */
const isSymmetric = (grid: Grid): boolean => {
  for (let i = 0; i < CELLS; i++) {
    if ((grid[i] !== 0) !== (grid[CELLS - 1 - i] !== 0)) return false;
  }
  return true;
};

describe('fair, tier-true generation (§6, §7)', () => {
  it('walked the whole set', () => {
    expect(runs).toHaveLength(SEEDS_PER_TIER * 3 + DAILY_DAYS);
  });

  it('ships exactly one answer on every board, and it is the one carried', () => {
    for (const { name, puzzle } of runs) {
      expect(countSolutions(puzzle.givens, 2), `${name} is not unique`).toBe(1);
      expect(isGridSolved(puzzle.solution), `${name}'s answer breaks a rule`).toBe(true);
      puzzle.givens.forEach((value, index) => {
        if (value !== 0) expect(value, `${name} clue ${index}`).toBe(puzzle.solution[index]);
      });
    }
  });

  it("is finished by the tier's own techniques — never by guessing", () => {
    for (const { name, puzzle } of runs) {
      expect(solvableWithin(puzzle.givens, puzzle.difficulty), `${name} needs more`).toBe(true);
      const tier = gradeTier(puzzle.givens);
      expect(tier, `${name} is ungraded`).not.toBeNull();
      expect(tier, `${name} reports a tier it does not grade at`).toBe(puzzle.tier);
      expect(TIER_RANK[tier!]).toBeLessThanOrEqual(TIER_RANK[puzzle.difficulty]);
    }
  });

  it("keeps the tier's floor, and its symmetry where the tier has it", () => {
    for (const { name, puzzle } of runs) {
      const plan = DIG_PLAN[puzzle.difficulty];
      expect(givensCount(puzzle.givens), name).toBeGreaterThanOrEqual(plan.minGivens);
      if (plan.symmetric) expect(isSymmetric(puzzle.givens), `${name} is not symmetric`).toBe(true);
    }
  });

  it('is deterministic: the same seed is the same puzzle, at the same cost', () => {
    const a = generatePuzzle('sudoku-6x6-repeat', 'hard');
    const b = generatePuzzle('sudoku-6x6-repeat', 'hard');
    expect(a.givens).toEqual(b.givens);
    expect(a.solution).toEqual(b.solution);
    expect(a.work).toBe(b.work);
    const again = generatePuzzle('sudoku-6x6-medium-g7', 'medium');
    const walked = runs.find((run) => run.name === 'medium g7')!.puzzle;
    expect(again.givens).toEqual(walked.givens);
    expect(again.work).toBe(walked.work);
  });

  it('throws only when no seed was drawn at all (§7 step 5)', () => {
    expect(() => generatePuzzle('sudoku-6x6-easy-g1', 'easy', 0)).toThrow(/after 0 seeds/);
  });
});

/**
 * §7 budgets generation per board on the device. The gate is the work itself,
 * which is a function of the seed and therefore identical on every machine;
 * the milliseconds are printed and never asserted.
 */
describe('generation cost (§7)', () => {
  const percentile = (values: number[], q: number): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  };

  it('stays inside the work budget on every board', () => {
    for (const group of [...DIFFICULTIES, 'daily'] as const) {
      const subset = runs.filter((run) => run.group === group);
      const works = subset.map((run) => run.puzzle.work);
      const attempts = subset.map((run) => run.puzzle.attempts);
      const givens = subset.map((run) => givensCount(run.puzzle.givens));
      const ms = subset.map((run) => run.ms);
      const tiers = { easy: 0, medium: 0, hard: 0 };
      for (const run of subset) tiers[run.puzzle.tier]++;
      console.log(
        `[sudoku-6x6 ${group}] n=${subset.length} work p50=${percentile(works, 0.5)} ` +
          `p90=${percentile(works, 0.9)} max=${Math.max(...works)} | attempts max=${Math.max(...attempts)} ` +
          `| givens p50=${percentile(givens, 0.5)} min=${Math.min(...givens)} max=${Math.max(...givens)} ` +
          `| needs easy=${tiers.easy} medium=${tiers.medium} hard=${tiers.hard} ` +
          `| ms p50=${percentile(ms, 0.5).toFixed(2)} max=${Math.max(...ms).toFixed(2)} (printed, not asserted)`,
      );
    }
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('never draws a derived seed', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
  });
});
