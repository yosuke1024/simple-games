/**
 * The invariants a shipped puzzle must hold (docs/SUDOKU_RULES.md §7): one
 * solution, solvable by the tier's technique set alone, inside the tier's clue
 * range, deterministic per seed, and generated inside the work budget.
 *
 * These are properties over many seeds rather than one golden board: the
 * guarantee is about every puzzle a player can reach, not a lucky example.
 */
import { describe, expect, it } from 'vitest';
import { clueCount, CLUE_RANGE, generatePuzzle, gridToString } from './generator';
import { grade, logicWork, solvableWithin } from './grader';
import { difficultyForLevel, levelSeed, MAX_LEVEL } from './levels';
import { countSolutions, isGridSolved, searchWork, solve } from './solver';
import { CELLS, DIFFICULTIES, type Difficulty, type Grid } from './types';

const SEEDS = [
  'sudoku-level-1',
  'sudoku-level-42',
  'sudoku-level-77',
  'sudoku-level-100',
  'sudoku-daily-2026-08-01',
  'sudoku-daily-2026-12-31',
];

/** Clues mirror around the centre: index i is filled iff 80 - i is. */
const isSymmetric = (grid: Grid): boolean => {
  for (let i = 0; i < CELLS; i++) {
    if ((grid[i] !== 0) !== (grid[CELLS - 1 - i] !== 0)) return false;
  }
  return true;
};

describe.each(DIFFICULTIES)('generatePuzzle — %s', (difficulty: Difficulty) => {
  const puzzles = SEEDS.map((seed) => generatePuzzle(seed, difficulty));

  it('admits exactly one solution', () => {
    for (const puzzle of puzzles) {
      expect(countSolutions(puzzle.givens, 2), puzzle.seed).toBe(1);
    }
  });

  it('carries the solution its clues lead to', () => {
    for (const puzzle of puzzles) {
      expect(isGridSolved(puzzle.solution), puzzle.seed).toBe(true);
      expect(gridToString(solve(puzzle.givens)!), puzzle.seed).toBe(gridToString(puzzle.solution));
      puzzle.givens.forEach((value, index) => {
        if (value !== 0) expect(value, `${puzzle.seed} clue ${index}`).toBe(puzzle.solution[index]);
      });
    }
  });

  it("is solvable by the tier's techniques alone — never by guessing", () => {
    for (const puzzle of puzzles) {
      expect(solvableWithin(puzzle.givens, difficulty), puzzle.seed).toBe(true);
    }
  });

  it('needs nothing beyond the tier when actually solved', () => {
    // The grader reports the hardest technique it really used; it must never
    // exceed the tier the player was promised.
    const rank: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
    for (const puzzle of puzzles) {
      const result = grade(puzzle.givens);
      expect(result.solvable, puzzle.seed).toBe(true);
      expect(
        rank[result.difficulty],
        `${puzzle.seed} used ${result.difficulty}`,
      ).toBeLessThanOrEqual(rank[difficulty]);
    }
  });

  it("lands in the tier's clue range and above the 17-clue floor", () => {
    const range = CLUE_RANGE[difficulty];
    for (const puzzle of puzzles) {
      const clues = clueCount(puzzle.givens);
      expect(clues, `${puzzle.seed} has ${clues} clues`).toBeGreaterThanOrEqual(range.min);
      expect(clues, `${puzzle.seed} has ${clues} clues`).toBeLessThanOrEqual(range.max);
      expect(clues).toBeGreaterThanOrEqual(17);
    }
  });

  it('is deterministic: the same seed rebuilds the same puzzle', () => {
    for (const puzzle of puzzles) {
      const again = generatePuzzle(puzzle.seed, difficulty);
      expect(gridToString(again.givens), puzzle.seed).toBe(gridToString(puzzle.givens));
      expect(gridToString(again.solution), puzzle.seed).toBe(gridToString(puzzle.solution));
    }
  });

  it('gives different seeds different puzzles', () => {
    expect(new Set(puzzles.map((p) => gridToString(p.givens))).size).toBe(puzzles.length);
  });
});

describe('symmetry (§6)', () => {
  it('keeps easy and medium boards 180° symmetric', () => {
    for (const difficulty of ['easy', 'medium'] as const) {
      for (const seed of SEEDS) {
        const puzzle = generatePuzzle(seed, difficulty);
        expect(isSymmetric(puzzle.givens), `${difficulty} ${seed}`).toBe(true);
      }
    }
  });

  it('lets hard trade symmetry for depth', () => {
    // Not an aesthetic preference but the documented trade: the single-cell
    // pass is what buys the extra clues of depth.
    const hardClues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, 'hard').givens));
    const mediumClues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, 'medium').givens));
    const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    expect(average(hardClues)).toBeLessThan(average(mediumClues));
  });
});

describe('difficulty separation (§6)', () => {
  it('gives each step up more techniques and fewer clues', () => {
    const average = (difficulty: Difficulty): number => {
      const clues = SEEDS.map((seed) => clueCount(generatePuzzle(seed, difficulty).givens));
      return clues.reduce((a, b) => a + b, 0) / clues.length;
    };
    const easy = average('easy');
    const medium = average('medium');
    const hard = average('hard');
    expect(easy).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(hard);
  });

  it('solves every easy board with singles only', () => {
    for (const seed of SEEDS) {
      const puzzle = generatePuzzle(seed, 'easy');
      expect(solvableWithin(puzzle.givens, 'easy'), seed).toBe(true);
      expect(grade(puzzle.givens).difficulty, seed).toBe('easy');
    }
  });

  it('keeps medium boards free of subset techniques', () => {
    for (const seed of SEEDS) {
      const puzzle = generatePuzzle(seed, 'medium');
      const result = grade(puzzle.givens);
      expect(result.techniques.includes('nakedPair'), seed).toBe(false);
      expect(result.techniques.includes('xWing'), seed).toBe(false);
    }
  });
});

describe('generation cost (§7)', () => {
  /**
   * §7 budgets generation in milliseconds *on the device*. This file cannot
   * measure that, and for a long time it pretended otherwise: it timed two
   * seeds with `performance.now()` and asserted the device budget against the
   * result. That assertion failed roughly one run in four under `pnpm test`,
   * because a stopwatch here measures the work times whatever else the machine
   * is doing — the suite runs its 53 files in parallel and draws about 3.4
   * cores on a machine with four performance cores.
   *
   * Loosening the number would not have fixed it. The spread is not a margin
   * problem: run the same two hard boards thirty times, idle and alone, and
   * the worst of the pair ranged from 37ms to 100ms — identical work every
   * time; what differed was where GC landed, back when generation allocated a
   * grid per search node. The search no longer does, which narrows that spread
   * without removing it. Any millisecond ceiling safe against it is far above
   * the budget it is supposed to enforce, which makes it not a budget.
   *
   * So the gate is the work itself, in the two units generation is made of.
   * Every digit the backtracking search tries is counted (`searchWork`), and
   * every technique scan the grader runs is counted (`logicWork`); a seed
   * always yields the same two counts on every machine, and generation cost
   * is a constant times each. Both are gated because the dig leans on both:
   * the grader decides every removal, and the search certifies the removals
   * that can be skipped for good (`generator.ts`). A regression in either — a
   * dig loop that probes more, a solver that loses its early exit or its
   * fewest-candidates heuristic, a finder that stops being reached for first —
   * shows up in its count with none of the noise. The milliseconds are still
   * measured and printed, because the figures §7 quotes should be
   * reproducible; they are just not asserted. The device-side promise is
   * verified on a device, per docs/RELEASE_CHECKLIST.md §2.
   */

  /**
   * Every level there is. A sparse sample measures the typical board and misses
   * the tail by construction, and the tail is what a player feels — the worst
   * board in a tier costs several times its median. The list used to be spread
   * over 999 levels, where sweeping all of them on every run was too much and
   * the sample needed its expensive levels pinned by hand; at 100 the whole
   * list fits in the same budget the old sample cost, so nothing is left out.
   */
  const SAMPLE_LEVELS = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1);

  /**
   * Per board: the measured median and worst of this sample, each rounded up.
   * They are exact, not approximate — the same seeds always cost the same
   * numbers, on any machine. They move only when generation deliberately
   * changes, and such a change already has to answer to compatibility.test.ts.
   */
  const CEILING: Record<
    Difficulty,
    {
      readonly placements: { readonly median: number; readonly worst: number };
      readonly scans: { readonly median: number; readonly worst: number };
    }
  > = {
    easy: { placements: { median: 250, worst: 400 }, scans: { median: 700, worst: 850 } },
    medium: { placements: { median: 2200, worst: 4500 }, scans: { median: 1600, worst: 2100 } },
    hard: { placements: { median: 9000, worst: 20000 }, scans: { median: 3600, worst: 4800 } },
  };

  const measured = SAMPLE_LEVELS.map((level) => {
    const difficulty = difficultyForLevel(level);
    searchWork.reset();
    logicWork.reset();
    const started = performance.now();
    generatePuzzle(levelSeed(level), difficulty);
    return {
      level,
      difficulty,
      placements: searchWork.read(),
      scans: logicWork.read(),
      ms: performance.now() - started,
    };
  });

  it.each(DIFFICULTIES)('keeps %s generation inside its work budget', (difficulty: Difficulty) => {
    const rows = measured.filter((row) => row.difficulty === difficulty);
    expect(rows.length, `no ${difficulty} levels in the sample`).toBeGreaterThan(0);

    const ms = rows.map((row) => row.ms).sort((a, b) => a - b);
    const at = (values: number[], q: number) => values[Math.floor(values.length * q)]!;
    const units = ['placements', 'scans'] as const;
    const measure = units.map((unit) => {
      const work = rows.map((row) => row[unit]).sort((a, b) => a - b);
      const median = work[Math.floor(work.length / 2)]!;
      const worst = rows.reduce((a, b) => (b[unit] > a[unit] ? b : a));
      return { unit, median, worst };
    });

    // Printed, not asserted: the reproducible source of the figures in §7.
    console.log(
      `[sudoku ${difficulty}] n=${rows.length} ` +
        measure
          .map((m) => `${m.unit} p50=${m.median} max=${m.worst[m.unit]} (level ${m.worst.level})`)
          .join(' ') +
        ` — ms p50=${at(ms, 0.5).toFixed(1)} p90=${at(ms, 0.9).toFixed(1)} ` +
        `max=${ms[ms.length - 1]!.toFixed(1)}`,
    );

    for (const { unit, median, worst } of measure) {
      expect(median, `${difficulty} median ${median} ${unit}`).toBeLessThan(
        CEILING[difficulty][unit].median,
      );
      expect(
        worst[unit],
        `${difficulty} worst ${worst[unit]} ${unit} at level ${worst.level}`,
      ).toBeLessThan(CEILING[difficulty][unit].worst);
    }
  });

  it('actually counts the work it claims to count', () => {
    // Without this, unhooking a counter would make every budget above pass
    // by measuring nothing — the quiet way a gate stops being a gate.
    searchWork.reset();
    logicWork.reset();
    expect(searchWork.read()).toBe(0);
    expect(logicWork.read()).toBe(0);
    generatePuzzle(levelSeed(1), 'easy');
    expect(searchWork.read()).toBeGreaterThan(100);
    expect(logicWork.read()).toBeGreaterThan(100);
  });
});
