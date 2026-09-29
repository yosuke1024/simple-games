/**
 * The promises of docs/BINARY_BALANCE_RULES.md §5–§7, measured rather than
 * assumed: every puzzle that ships has exactly one answer (counted by the full
 * search, not taken from the technique solver), carries at least one link,
 * grades at the tier it was asked for, is settled by that tier's techniques
 * alone and not by the tier below, generation is deterministic, the fallback
 * stays theoretical — and, driven on purpose with a tiny attempt limit, ships
 * what §6 says it ships — and the work stays inside its budget.
 *
 * Forty fixed seeds per tier and two years of dailies: the budgets below are
 * stated against that whole walk. The table it prints is the one in §6.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed } from './daily';
import { findViolations, isSolved } from './engine';
import { ATTEMPT_LIMIT, generatePuzzle, type GeneratedPuzzle } from './generator';
import { buildLayout, countSolutions, grade, solve, TIER_TECHNIQUES } from './solver';
import { DIFFICULTIES, type Cell, type Difficulty } from './types';

/**
 * Solver steps one board may cost (`solverWork` — the comment there says why
 * it is counted at all), per tier. Each sits at roughly three times the worst
 * board of the walk below (§6 table). A regression gate, not a device promise:
 * what it catches is a technique loop that stops escalating cheapest-first, a
 * T5 that lost its dirty-line propagation, or a counting search that lost its
 * pruning. The daily is Medium and is held to Medium's budget.
 */
const WORK_BUDGET: Record<Difficulty, number> = {
  easy: 40_000,
  medium: 150_000,
  hard: 650_000,
};

/**
 * Derived seeds one board may cost (§6). Far below ATTEMPT_LIMIT, so a tier
 * drifting up to here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 20;

const SEEDS_PER_TIER = 40;
const DAILY_DAYS = 730;

interface Run {
  readonly name: string;
  readonly group: Difficulty | 'daily';
  readonly difficulty: Difficulty;
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

/** Built once: every describe reads the same walk rather than repeating it. */
function walk(): Run[] {
  const runs: Run[] = [];
  const time = (
    name: string,
    group: Difficulty | 'daily',
    difficulty: Difficulty,
    seed: string,
  ): void => {
    const started = performance.now();
    const puzzle = generatePuzzle(seed, difficulty);
    runs.push({ name, group, difficulty, puzzle, ms: performance.now() - started });
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      time(`${difficulty} g${n}`, difficulty, difficulty, `binary-balance-${difficulty}-g${n}`);
    }
  }
  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    time(`daily ${date}`, 'daily', DAILY_DIFFICULTY, dailySeed(date));
    date = addDays(date, 1);
  }
  return runs;
}

const runs = walk();

const BELOW: Partial<Record<Difficulty, Difficulty>> = { medium: 'easy', hard: 'medium' };

describe('unique, tier-true generation (§5–§7)', () => {
  it('ships exactly one answer on every board, and it keeps all three rules', () => {
    for (const { name, puzzle } of runs) {
      const layout = buildLayout(puzzle.links, puzzle.size);
      expect(countSolutions(puzzle.givens, layout, 2), `${name} is not unique`).toBe(1);
      expect(isSolved(puzzle.solution, puzzle.links, puzzle.size), `${name}'s answer`).toBe(true);
      puzzle.givens.forEach((given, index) => {
        if (given !== -1) expect(given, `${name} given ${index}`).toBe(puzzle.solution[index]);
      });
    }
  });

  it('always carries at least one link (§6 step 4)', () => {
    for (const { name, puzzle } of runs) {
      expect(puzzle.links.length, `${name} has no link`).toBeGreaterThanOrEqual(1);
    }
  });

  it("is settled by the tier's own techniques, and lands on the answer", () => {
    for (const { name, difficulty, puzzle } of runs) {
      const layout = buildLayout(puzzle.links, puzzle.size);
      const result = solve(puzzle.givens, layout, TIER_TECHNIQUES[difficulty]);
      expect(result.contradiction, `${name} contradicts itself`).toBe(false);
      expect(result.solved, `${name} needs more than its tier`).toBe(true);
      expect(result.board, `${name} settles on a different board`).toEqual([...puzzle.solution]);
    }
  });

  it('is not settled by the tier below (Medium and Hard are earned)', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const below = BELOW[difficulty];
      if (below === undefined) continue;
      const layout = buildLayout(puzzle.links, puzzle.size);
      expect(
        solve(puzzle.givens, layout, TIER_TECHNIQUES[below]).solved,
        `${name} is only ${below}`,
      ).toBe(false);
    }
  });

  it('never falls back: every board grades at the tier it asked for', () => {
    for (const { name, difficulty, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.tier, `${name} shipped at another tier`).toBe(difficulty);
      expect(grade(puzzle.givens, buildLayout(puzzle.links, puzzle.size)), name).toBe(difficulty);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('binary-balance-repeat', 'hard');
    const b = generatePuzzle('binary-balance-repeat', 'hard');
    expect(a.givens).toEqual(b.givens);
    expect(a.links).toEqual(b.links);
    expect(a.attempts).toBe(b.attempts);
    expect(a.work).toBe(b.work);
    // And a walked seed is a pure function of itself, walk or no walk.
    const again = generatePuzzle('binary-balance-medium-g7', 'medium');
    expect(again.givens).toEqual([...runs.find((run) => run.name === 'medium g7')!.puzzle.givens]);
  });

  /**
   * §14: this is not Takuzu. Its third rule is not here, so a finished board
   * may repeat a row — and the walk does deal such boards.
   */
  it('deals boards with two identical rows or columns, and calls them legal', () => {
    const repeats = (cells: readonly Cell[], size: number): boolean => {
      const rows = new Set<string>();
      const cols = new Set<string>();
      for (let i = 0; i < size; i++) {
        rows.add(cells.slice(i * size, i * size + size).join(''));
        cols.add(Array.from({ length: size }, (_, r) => cells[r * size + i]).join(''));
      }
      return rows.size < size || cols.size < size;
    };
    const repeating = runs.filter((run) => repeats(run.puzzle.solution, run.puzzle.size));
    expect(repeating.length).toBeGreaterThan(0);
    for (const { name, puzzle } of repeating) {
      expect(findViolations(puzzle.solution, puzzle.links, puzzle.size).any, name).toBe(false);
    }
  });
});

/**
 * §6 step 6, which no walked seed reaches: the limit is the one seam into it.
 * The seeds are chosen for what their first derived seeds happen to grade at,
 * so each case below is the fallback choosing between known candidates.
 */
describe('the fallback (§6 steps 6 and 7)', () => {
  const checkShippable = (puzzle: GeneratedPuzzle): void => {
    const layout = buildLayout(puzzle.links, puzzle.size);
    expect(countSolutions(puzzle.givens, layout, 2)).toBe(1);
    expect(isSolved(puzzle.solution, puzzle.links, puzzle.size)).toBe(true);
    expect(solve(puzzle.givens, layout, TIER_TECHNIQUES[puzzle.tier]).solved).toBe(true);
    expect(puzzle.links.length).toBeGreaterThan(0);
  };

  it('ships the easier board, flagged, with the seeds it really drew', () => {
    // Medium g6: the first derived seed grades Easy; the second is Medium.
    const one = generatePuzzle('binary-balance-medium-g6', 'medium', 1);
    expect(one).toMatchObject({ fallback: true, tier: 'easy', attempts: 1, givensCount: 8 });
    checkShippable(one);
  });

  it('picks the candidate with the fewest givens among those it drew', () => {
    // Hard g4: the first two derived seeds grade Medium, at 6 givens and
    // then 3; the third is Hard.
    expect(generatePuzzle('binary-balance-hard-g4', 'hard', 1)).toMatchObject({
      fallback: true,
      tier: 'medium',
      givensCount: 6,
    });
    const two = generatePuzzle('binary-balance-hard-g4', 'hard', 2);
    expect(two).toMatchObject({ fallback: true, tier: 'medium', attempts: 2, givensCount: 3 });
    checkShippable(two);
  });

  it('is still a pure function of the seed', () => {
    const a = generatePuzzle('binary-balance-hard-g4', 'hard', 2);
    const b = generatePuzzle('binary-balance-hard-g4', 'hard', 2);
    expect(a.givens).toEqual(b.givens);
    expect(a.links).toEqual(b.links);
    expect(a.work).toBe(b.work);
  });

  it('throws only when not one candidate came up', () => {
    expect(() => generatePuzzle('binary-balance-easy-g1', 'easy', 0)).toThrow(
      /no easy candidate after 0 seeds/,
    );
  });
});

/**
 * §6 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted.
 */
describe('generation cost (§6)', () => {
  const percentile = (values: number[], q: number): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  };

  it('stays inside the work budget on every board', () => {
    for (const group of [...DIFFICULTIES, 'daily'] as const) {
      const subset = runs.filter((run) => run.group === group);
      const works = subset.map((run) => run.puzzle.work);
      const attempts = subset.map((run) => run.puzzle.attempts);
      const givens = subset.map((run) => run.puzzle.givensCount);
      const links = subset.map((run) => run.puzzle.links.length);
      const ms = subset.map((run) => run.ms);
      console.log(
        `[binary-balance ${group}] n=${subset.length} work p50=${percentile(works, 0.5)} ` +
          `p90=${percentile(works, 0.9)} max=${Math.max(...works)} | attempts ` +
          `p50=${percentile(attempts, 0.5)} max=${Math.max(...attempts)} | fallback=` +
          `${subset.filter((run) => run.puzzle.fallback).length} | givens ` +
          `min=${Math.min(...givens)} p50=${percentile(givens, 0.5)} max=${Math.max(...givens)} | ` +
          `links min=${Math.min(...links)} p50=${percentile(links, 0.5)} max=${Math.max(...links)} | ` +
          `ms p50=${percentile(ms, 0.5).toFixed(1)} max=${Math.max(...ms).toFixed(1)} ` +
          `(printed, not asserted)`,
      );
    }
    for (const { name, difficulty, puzzle } of runs) {
      expect(puzzle.work, `${name} cost ${puzzle.work}`).toBeLessThan(WORK_BUDGET[difficulty]);
    }
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
