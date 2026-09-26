/**
 * The promises of docs/NUMBER_PATH_RULES.md §6, measured rather than assumed:
 * every board that ships has exactly one road, lands inside its tier on both
 * axes, is a pure function of its seed, never falls back, and stays inside
 * its work budget.
 *
 * Forty seeds per difficulty and two years of dailies are walked, not
 * sampled — the whole walk costs a few seconds, and sampling would only buy
 * the chance of shipping the one board that is broken.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed } from './daily';
import { isLegalPrefix, isSolution } from './engine';
import {
  ATTEMPT_LIMIT,
  buildHamiltonianPath,
  generatePuzzle,
  type GeneratedPuzzle,
} from './generator';
import { countSolutions } from './solver';
import { DIFFICULTIES, inRange, TIERS, type Difficulty } from './types';

/**
 * Solver nodes plus backbite moves one board may cost (`GeneratedPuzzle.work`,
 * and the reason it is counted at all is in `solverWork`'s comment). Measured
 * on 200 seeds per difficulty and two years of dailies: the worst is a hard
 * board at 59,752, so the budget sits at about twice the worst case. It is a
 * regression gate, not a device promise — what it catches is a pruning rule
 * dropped from the solver, or a reduction that starts solving boards it has
 * already settled.
 */
const WORK_BUDGET = 120_000;

/**
 * Derived seeds one board may cost (§6). Measured on the same set: 82–93% of
 * boards land on the first road, and the worst needs five. The cap is
 * ATTEMPT_LIMIT and this budget is far below it, so a seed drifting up to
 * here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 8;

const SEEDS_PER_DIFFICULTY = 40;
const DAILY_DAYS = 730;

interface Run {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly puzzle: GeneratedPuzzle;
}

/** Built once: every describe reads the same walk rather than repeating it. */
function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < SEEDS_PER_DIFFICULTY; i++) {
      const seed = `number-path-${difficulty}-n${i}`;
      runs.push({ name: seed, difficulty, puzzle: generatePuzzle(seed, difficulty) });
    }
  }
  let date = '2026-09-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push({
      name: `daily ${date}`,
      difficulty: DAILY_DIFFICULTY,
      puzzle: generatePuzzle(dailySeed(date), DAILY_DIFFICULTY),
    });
    date = addDays(date, 1);
  }
  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();

describe('the road (§6)', () => {
  it('covers every cell of the grid, one open step at a time', () => {
    for (const [width, height] of [
      [5, 5],
      [6, 6],
      [7, 7],
    ] as const) {
      const path = buildHamiltonianPath(`road-${width}`, width, height);
      expect(path).toHaveLength(width * height);
      expect(new Set(path).size).toBe(width * height);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!;
        const b = path[i]!;
        const sameRow = Math.floor(a / width) === Math.floor(b / width) && Math.abs(a - b) === 1;
        const sameCol = Math.abs(a - b) === width;
        expect(sameRow || sameCol, `step ${i} of the ${width}×${height} road`).toBe(true);
      }
    }
    // And a different seed bends it differently.
    expect(buildHamiltonianPath('a', 5, 5)).not.toEqual(buildHamiltonianPath('b', 5, 5));
  });
});

describe('one road per board (§2, §6)', () => {
  it('ships a board whose stored solution is its one and only road', () => {
    for (const { name, puzzle } of runs) {
      expect(isSolution(puzzle.board, puzzle.solution), `${name}: the solution is not a road`).toBe(
        true,
      );
      const check = countSolutions(puzzle.board);
      expect(check.solutions, `${name} has ${check.solutions} roads`).toBe(1);
      expect(check.solution, `${name} settles on a different road`).toEqual([...puzzle.solution]);
      expect(check.branches, `${name} reports a different branch count`).toBe(puzzle.branches);
      expect(isLegalPrefix(puzzle.board, [puzzle.board.cellOf[1]!])).toBe(true);
    }
  });

  it('lands inside its tier on every axis, and never falls back', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const tier = TIERS[difficulty];
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
      expect(puzzle.board.width).toBe(tier.width);
      expect(puzzle.board.height).toBe(tier.height);
      expect(
        inRange(puzzle.board.last, tier.numbers),
        `${name} carries ${puzzle.board.last} numbers`,
      ).toBe(true);
      expect(
        inRange(puzzle.board.walls.length, tier.walls),
        `${name} carries ${puzzle.board.walls.length} walls`,
      ).toBe(true);
      expect(inRange(puzzle.branches, tier.branches), `${name} branches ${puzzle.branches}`).toBe(
        true,
      );
    }
  });

  it('uses the whole of each tier’s number range', () => {
    for (const difficulty of DIFFICULTIES) {
      const counts = new Set(
        runs.filter((run) => run.difficulty === difficulty).map((run) => run.puzzle.board.last),
      );
      const tier = TIERS[difficulty];
      for (let k = tier.numbers.min; k <= tier.numbers.max; k++) {
        expect(counts.has(k), `no ${difficulty} board with ${k} numbers`).toBe(true);
      }
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('number-path-repeat', 'medium');
    const b = generatePuzzle('number-path-repeat', 'medium');
    expect(a.solution).toEqual(b.solution);
    expect(a.board.walls).toEqual(b.board.walls);
    expect(a.board.numbers).toEqual(b.board.numbers);
    expect(a.attempts).toBe(b.attempts);
    expect(a.work).toBe(b.work);
    // And a walked seed is a pure function of its name, walk or no walk.
    const again = generatePuzzle('number-path-hard-n3', 'hard');
    expect(again.solution).toEqual([
      ...runs.find((run) => run.name === 'number-path-hard-n3')!.puzzle.solution,
    ]);
  });
});

/**
 * §6 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical
 * on every machine. The milliseconds are printed and never asserted.
 */
describe('generation cost (§6)', () => {
  it('stays inside the work budget on every board', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    const total = runs.reduce((sum, run) => sum + run.puzzle.work, 0);
    console.log(
      `[number-path] ${runs.length} boards: worst work=${worst.puzzle.work} (${worst.name}) ` +
        `total=${total} — ms=${ms.toFixed(0)} (printed, not asserted)`,
    );
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('rarely needs a second road, and never approaches the cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    const retried = runs.filter((run) => run.puzzle.attempts > 1).length;
    console.log(
      `[number-path] ${retried}/${runs.length} boards needed a derived seed; ` +
        `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
    );
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
  });
});
