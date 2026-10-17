/**
 * The promises of docs/LOOP_PUZZLE_RULES.md §7–§8, measured rather than
 * assumed, on every board walked: each one ships one loop (proven twice — by
 * the counting search and by the independent cell-colouring oracle), is
 * graded to its tier by the techniques and needs them, keeps to its tier's
 * clue range, is a pure function of its seed, never falls back, and stays
 * inside its work budget.
 *
 * Two hundred fixed seeds per tier plus two years of dailies are walked, not
 * sampled (§16): difficulty seeds are minted at play time and cannot all be
 * walked, so a fixed set stands in for them, while the dailies are the exact
 * boards every player will see.
 */
import { describe, expect, it } from 'vitest';
import { addDays, DAILY_DIFFICULTY, dailySeed } from './daily';
import { emptyMarks, isSolved } from './engine';
import {
  ATTEMPT_LIMIT,
  GENERATION_WORK_LIMIT,
  TIERS,
  generatePuzzle,
  type GeneratedPuzzle,
} from './generator';
import { COUNT_NODE_LIMIT, countSolutions, findHint, solveWithTechniques } from './solver';
import { oracleCount } from './test-helpers';
import { DIFFICULTIES, PRESETS, UNKNOWN, type Difficulty } from './types';

/**
 * Solver work per board (`GeneratedPuzzle.work`), per tier: a **regression
 * gate on this fixed set**, not a bound and not a device promise. It sits at
 * roughly 1.5–3 times this walk's worst case (the table in §8) — larger
 * samples of minted seeds reach further, which is what GENERATION_WORK_LIMIT
 * bounds (§8). What the gate catches is a technique that stops propagating,
 * a thinning that stops batching, or a tier whose hit rate collapsed, long
 * before any of it reaches the budget and turns into fallbacks.
 */
const WORK_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 10_000,
  medium: 40_000,
  hard: 300_000,
  daily: 40_000,
};

/**
 * Derived seeds one board may cost (§8). The cap is ATTEMPT_LIMIT (24) and
 * this budget sits well short of it, so a tier drifting up here is a warning
 * long before anything falls back.
 */
const ATTEMPT_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 10,
  medium: 6,
  hard: 10,
  daily: 6,
};

/** The clue range each tier ships (§7): from the thinning target to the cap. */
const CLUE_RANGE: Record<Difficulty, readonly [number, number]> = {
  easy: [TIERS.easy.clueTarget, TIERS.easy.clueMax],
  medium: [TIERS.medium.clueTarget, TIERS.medium.clueMax],
  hard: [1, TIERS.hard.clueMax],
};

const SEEDS_PER_TIER = 200;
const DAILY_DAYS = 730;
const FIRST_DAY = '2026-10-17';

interface Run {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly group: Difficulty | 'daily';
  readonly puzzle: GeneratedPuzzle;
  readonly ms: number;
}

function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];
  const timed = (name: string, difficulty: Difficulty, group: Run['group'], seed: string): Run => {
    const t0 = performance.now();
    const puzzle = generatePuzzle(seed, difficulty);
    return { name, difficulty, group, puzzle, ms: performance.now() - t0 };
  };
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      const seed = `loop-puzzle-${difficulty}-g${n}`;
      runs.push(timed(seed, difficulty, difficulty, seed));
    }
  }
  let date = FIRST_DAY;
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push(timed(`daily ${date}`, DAILY_DIFFICULTY, 'daily', dailySeed(date)));
    date = addDays(date, 1)!;
  }
  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();
const GROUPS = [...DIFFICULTIES, 'daily'] as const;
const clueCount = (puzzle: GeneratedPuzzle): number =>
  puzzle.clues.filter((c) => c !== null).length;
const quantile = (values: readonly number[], q: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))]!;
};

describe('one loop on every board (§3, §8)', () => {
  it('ships an answer that is one loop meeting every number, with numbers 0–3 only', () => {
    for (const { name, puzzle } of runs) {
      expect(isSolved(puzzle, puzzle.solution), `${name}: the answer breaks a rule`).toBe(true);
      for (const clue of puzzle.clues) {
        if (clue !== null) expect(clue >= 0 && clue <= 3, name).toBe(true);
      }
    }
  });

  it('has exactly one loop by the counting search, and it is the stored answer', () => {
    for (const { name, puzzle } of runs) {
      const count = countSolutions(puzzle);
      expect(count.complete, `${name}: the count ran out of nodes`).toBe(true);
      expect(count.count, `${name} is not unique`).toBe(1);
      expect(count.solution, `${name} settles on another loop`).toEqual([...puzzle.solution]);
      // A board this close to the limit would be one solver change away from
      // failing its own proof on load (§12): warn long before that.
      expect(count.nodes, `${name} needs ${count.nodes} nodes`).toBeLessThan(COUNT_NODE_LIMIT / 2);
    }
  });

  it('has exactly one loop by the independent oracle, too', () => {
    let nodes = 0;
    for (const { name, puzzle } of runs) {
      const oracle = oracleCount(puzzle);
      expect(oracle.complete, `${name}: the oracle ran out of nodes`).toBe(true);
      expect(oracle.count, `${name}: the oracle finds ${oracle.count} loops`).toBe(1);
      expect(oracle.solution, `${name}: the oracle finds another loop`).toEqual([
        ...puzzle.solution,
      ]);
      nodes = Math.max(nodes, oracle.nodes);
    }
    console.log(`[loop-puzzle] oracle: ${runs.length} boards, worst ${nodes} nodes`);
  });
});

/**
 * The hint of §6 on every tenth walked board: from an empty board, doing
 * exactly what each hint says finishes the board, every hint agrees with the
 * answer, and the techniques never fall silent (no 'reveal').
 */
describe('the hint walk (§6)', () => {
  it('finishes every sampled board by following hints alone', () => {
    let calls = 0;
    const sampled = runs.filter((_, i) => i % 10 === 0);
    for (const { name, puzzle } of sampled) {
      const marks = emptyMarks(puzzle);
      while (!isSolved(puzzle, marks)) {
        const hint = findHint(puzzle, puzzle.solution, marks);
        calls++;
        expect(hint?.kind, `${name}: the hint ran out`).toBe('step');
        if (hint?.kind !== 'step') break;
        expect(hint.step.mark, name).toBe(puzzle.solution[hint.step.edge]);
        expect(marks[hint.step.edge], name).toBe(UNKNOWN);
        marks[hint.step.edge] = hint.step.mark;
      }
    }
    console.log(`[loop-puzzle] hint walk: ${sampled.length} boards, ${calls} hints`);
  });
});

describe('tiers (§7)', () => {
  it('is settled by its tier’s techniques, needs them, and lands on its own answer', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const tier = TIERS[difficulty];
      expect(puzzle.grade, `${name} graded ${puzzle.grade}`).toBe(tier.level);
      const result = solveWithTechniques(puzzle, tier.level);
      expect(result.status, `${name} needs more than its tier`).toBe('solved');
      expect(result.marks, name).toEqual([...puzzle.solution]);
      if (tier.level > 1) {
        const below = solveWithTechniques(puzzle, (tier.level - 1) as 1 | 2);
        expect(below.status, `${name} is solved by the tier below`).toBe('stuck');
      }
      if (difficulty === 'hard') expect(puzzle.trials, name).toBeGreaterThan(0);
    }
  });

  it('keeps every board inside its tier’s clue range', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const [lo, hi] = CLUE_RANGE[difficulty];
      const count = clueCount(puzzle);
      expect(count, `${name} carries ${count} clues`).toBeGreaterThanOrEqual(lo);
      expect(count, `${name} carries ${count} clues`).toBeLessThanOrEqual(hi);
      expect(puzzle.width).toBe(PRESETS[difficulty].width);
      expect(puzzle.height).toBe(PRESETS[difficulty].height);
    }
  });

  it('gets harder with the tier, not only bigger: fewer clues per cell, deeper techniques', () => {
    const density = (group: Difficulty): number =>
      quantile(
        runs
          .filter((run) => run.group === group)
          .map((run) => clueCount(run.puzzle) / (run.puzzle.width * run.puzzle.height)),
        0.5,
      );
    expect(density('medium')).toBeLessThan(density('easy'));
    expect(density('hard')).toBeLessThan(density('medium'));
    // Every Hard board needs at least one trial; most need several.
    const trials = runs.filter((run) => run.group === 'hard').map((run) => run.puzzle.trials);
    expect(Math.min(...trials)).toBeGreaterThanOrEqual(1);
    expect(quantile(trials, 0.5)).toBeGreaterThanOrEqual(2);
    console.log(
      `[loop-puzzle] clue density p50: easy ${density('easy').toFixed(2)}, ` +
        `medium ${density('medium').toFixed(2)}, hard ${density('hard').toFixed(2)}; ` +
        `hard trials p50 ${quantile(trials, 0.5)} max ${Math.max(...trials)}`,
    );
  });

  it('never falls back to a bundled board', () => {
    for (const { name, puzzle } of runs) expect(puzzle.fallback, `${name} fell back`).toBe(false);
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    for (const run of runs.filter((_, i) => i % 97 === 0)) {
      const seed = run.group === 'daily' ? dailySeed(run.name.slice(6)) : run.name;
      expect(generatePuzzle(seed, run.difficulty)).toEqual(run.puzzle);
    }
  });
});

/**
 * §8 budgets generation per board on the device. Asserting that with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted (and under
 * the test runner they read about three times what a production build does).
 */
describe('generation cost (§8)', () => {
  it('stays inside its work and derived-seed budgets on every board', () => {
    for (const group of GROUPS) {
      const own = runs.filter((run) => run.group === group);
      const works = own.map((run) => run.puzzle.work);
      const attempts = own.map((run) => run.puzzle.attempts);
      const times = own.map((run) => run.ms);
      const worst = own.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
      console.log(
        `[loop-puzzle] ${group}: n=${own.length} work p50=${quantile(works, 0.5)} ` +
          `p90=${quantile(works, 0.9)} max=${worst.puzzle.work} (${worst.name}); ` +
          `first seed ${attempts.filter((a) => a === 1).length}/${own.length}, ` +
          `worst ${Math.max(...attempts)} of ${ATTEMPT_LIMIT}; ` +
          `ms p50=${quantile(times, 0.5).toFixed(1)} max=${Math.max(...times).toFixed(1)} ` +
          `(printed, not asserted)`,
      );
      expect(worst.puzzle.work, `${group} worst work at ${worst.name}`).toBeLessThan(
        WORK_BUDGET[group],
      );
      expect(WORK_BUDGET[group]).toBeLessThan(GENERATION_WORK_LIMIT);
      expect(Math.max(...attempts), group).toBeLessThanOrEqual(ATTEMPT_BUDGET[group]);
    }
    console.log(`[loop-puzzle] walk of ${runs.length} boards: ${ms.toFixed(0)} ms`);
  });
});
