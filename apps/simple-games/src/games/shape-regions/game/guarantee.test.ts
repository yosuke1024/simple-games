/**
 * The promises of docs/SHAPE_REGIONS_RULES.md §7–§8, measured rather than
 * assumed: every puzzle that ships is unique, is graded to its tier by the
 * technique solver, is deterministic, never falls back, and stays inside its
 * work budget.
 *
 * Forty fixed seeds per tier plus two years of dailies are walked, not
 * sampled: difficulty seeds are minted at play time and cannot all be
 * walked, so a fixed set stands in for them, while the dailies are the exact
 * boards every player will see.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, DAILY_DIFFICULTY } from './daily';
import { initialAssignment, isSolved, regionSatisfiesClue } from './engine';
import { ATTEMPT_LIMIT, TIERS, generatePuzzle, type GeneratedPuzzle } from './generator';
import { fixedPolyominoes } from './shapes';
import { countSolutions, solve } from './solver';
import {
  colOf,
  DIFFICULTIES,
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
  rowOf,
  type Difficulty,
  type Layout,
} from './types';

/**
 * Placements checked plus search nodes per board (`solverWork`, and the
 * reason it is counted is in that comment). Measured on this walk: the
 * worst board is a hard one at under 450,000, and the worst daily under
 * 100,000, so the budget sits at roughly 3.5× the worst case. A regression
 * gate, not a device promise — what it catches is a counter that stops
 * propagating, a solver that re-reads the full placement table each round,
 * or a tier whose hit rate collapsed.
 */
const WORK_BUDGET = 1_500_000;

/**
 * Derived seeds one board may cost (§8). Measured: most boards land on the
 * first or second seed, the worst on this walk under ten. The cap is
 * ATTEMPT_LIMIT and this budget is far below it, so a board drifting up to
 * here is a warning long before anything falls back.
 */
const ATTEMPT_BUDGET = 24;

const SEEDS_PER_TIER = 40;
const DAILY_DAYS = 730;

interface Run {
  readonly name: string;
  readonly difficulty: Difficulty;
  readonly puzzle: GeneratedPuzzle;
}

function walk(): { runs: Run[]; ms: number } {
  const started = performance.now();
  const runs: Run[] = [];
  for (const difficulty of DIFFICULTIES) {
    for (let n = 1; n <= SEEDS_PER_TIER; n++) {
      const seed = `shape-regions-${difficulty}-g${n}`;
      runs.push({ name: seed, difficulty, puzzle: generatePuzzle(seed, difficulty) });
    }
  }
  let date = '2026-08-01';
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

describe('unique, tier-graded generation (§7, §8)', () => {
  it('ships a legal partition as the answer on every board', () => {
    for (const { name, puzzle } of runs) {
      expect(isSolved(puzzle, puzzle.solution), `${name} answer breaks a rule`).toBe(true);
      expect(
        puzzle.clues.every((c) => c.size !== null || c.shape !== null),
        name,
      ).toBe(true);
    }
  });

  it('has exactly one solution on every board', () => {
    for (const { name, puzzle } of runs) {
      expect(countSolutions(puzzle), `${name} is not unique`).toBe(1);
    }
  });

  it('is settled by its tier’s techniques, and lands on its own answer', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const tier = TIERS[difficulty];
      expect(tier.grades, `${name} graded ${puzzle.grade}`).toContain(puzzle.grade);
      const result = solve(puzzle, initialAssignment(puzzle), difficulty === 'hard');
      expect(result.solved, `${name} needs a guess`).toBe(true);
      expect(result.fixed, `${name} settles on another board`).toEqual([...puzzle.solution]);
      if (difficulty === 'hard') {
        expect(result.usedHypothesis, `${name} did not need T4`).toBe(true);
        expect(solve(puzzle, initialAssignment(puzzle), false).solved, name).toBe(false);
      }
    }
  });

  it('reduces clues as far as its tier asks', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const n = puzzle.clues.length;
      const tier = TIERS[difficulty];
      expect(puzzle.reducedCount, `${name} reduced too few`).toBeGreaterThanOrEqual(
        tier.reduceFloor(n),
      );
      expect(puzzle.reducedCount, `${name} reduced too many`).toBeLessThanOrEqual(
        tier.reduceTarget(n),
      );
    }
  });

  it('never falls back to a board short of its tier', () => {
    for (const { name, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('shape-regions-repeat', 'medium');
    const b = generatePuzzle('shape-regions-repeat', 'medium');
    expect(a.solution).toEqual(b.solution);
    expect(a.clues).toEqual(b.clues);
    expect(a.attempts).toBe(b.attempts);
    expect(a.work).toBe(b.work);
    const again = generatePuzzle('shape-regions-hard-g7', 'hard');
    expect(again.clues).toEqual(
      runs.find((run) => run.name === 'shape-regions-hard-g7')!.puzzle.clues,
    );
  });
});

/**
 * Every placement a clue's cells could satisfy, read straight from
 * `fixedPolyominoes` and `regionSatisfiesClue` — never from
 * `SHAPE_CATALOG`/`catalogFor`, which `countSolutions` (via
 * `enumeratePlacements`) is itself built on. `countSolutions` re-checking the
 * generator's own uniqueness proof with its own candidate list cannot catch a
 * drift between the rules (engine.ts) and the catalog (shapes.ts) — that is
 * exactly what the high-severity placements.ts finding was: a number-only
 * clue's win condition once accepted shapes the catalog never offered
 * `countSolutions`. This oracle is independent of both.
 */
function rulesBasedPlacements(layout: Layout, region: number): number[][] {
  const clue = layout.clues[region]!;
  const { width, height } = layout;
  const clueCells = new Set(layout.clues.map((c) => c.index));
  const sizes =
    clue.size !== null
      ? [clue.size]
      : Array.from(
          { length: MAX_REGION_SIZE - MIN_REGION_SIZE + 1 },
          (_, i) => MIN_REGION_SIZE + i,
        );
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const size of sizes) {
    for (const poly of fixedPolyominoes(size)) {
      for (const anchor of poly) {
        const originRow = rowOf(clue.index, width) - anchor.r;
        const originCol = colOf(clue.index, width) - anchor.c;
        if (originRow < 0 || originCol < 0) continue;
        const cells: number[] = [];
        let ok = true;
        for (const cell of poly) {
          const r = originRow + cell.r;
          const c = originCol + cell.c;
          if (r >= height || c >= width) {
            ok = false;
            break;
          }
          const index = r * width + c;
          if (index !== clue.index && clueCells.has(index)) {
            ok = false;
            break;
          }
          cells.push(index);
        }
        if (!ok || !regionSatisfiesClue(cells, clue, width)) continue;
        cells.sort((a, b) => a - b);
        const key = cells.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(cells);
      }
    }
  }
  return out;
}

/** Exact cover over `rulesBasedPlacements`, up to `limit` — the same shape as `countSolutions`. */
function rulesBasedSolutionCount(layout: Layout, limit: number): number {
  const cellCount = layout.width * layout.height;
  const perRegion = layout.clues.map((_, region) => rulesBasedPlacements(layout, region));
  const taken = new Array<boolean>(cellCount).fill(false);
  let found = 0;
  const place = (region: number): void => {
    if (found >= limit) return;
    if (region === perRegion.length) {
      if (taken.every(Boolean)) found++;
      return;
    }
    for (const cells of perRegion[region]!) {
      if (found >= limit) return;
      if (cells.some((cell) => taken[cell])) continue;
      for (const cell of cells) taken[cell] = true;
      place(region + 1);
      for (const cell of cells) taken[cell] = false;
    }
  };
  place(0);
  return found;
}

describe('an independent rules-only oracle agrees with countSolutions (§3, §7, §8)', () => {
  it('finds the same uniqueness on a handful of real boards, not just the catalog', () => {
    // A handful, not all 850 — `fixedPolyominoes` re-enumerates every shape
    // per clue rather than reading the memoised catalog, so this is slower
    // than `countSolutions`; a few boards are enough to catch a drift
    // between the rules and the catalog without slowing the suite down.
    // `easy-g38` is the exact seed the placements.ts finding reproduced a
    // second, catalog-outside solution on before this fix.
    const sample = [
      runs.find((run) => run.name === 'shape-regions-easy-g1')!,
      runs.find((run) => run.name === 'shape-regions-easy-g38')!,
      runs.find((run) => run.name === 'shape-regions-medium-g1')!,
    ];
    for (const { name, puzzle } of sample) {
      expect(rulesBasedSolutionCount(puzzle, 2), name).toBe(countSolutions(puzzle));
    }
  });
});

/**
 * §8 budgets generation per board on the device. Asserting that here with
 * `performance.now()` would measure the work times whatever else the machine
 * is doing — under `pnpm test`, several other vitest forks — so the gate is
 * the work itself, which is a function of the seed and therefore identical on
 * every machine. The milliseconds are printed and never asserted (the
 * reasoning, and the 41× spread that produced it, is in SUDOKU_RULES.md §7).
 */
describe('generation cost (§8)', () => {
  it('stays inside the work budget on every board', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
    for (const difficulty of [...DIFFICULTIES, 'daily'] as const) {
      const subset = runs.filter((run) =>
        difficulty === 'daily'
          ? run.name.startsWith('daily')
          : run.name.includes(`-${difficulty}-`),
      );
      const works = subset.map((run) => run.puzzle.work).sort((a, b) => a - b);
      const pct = (p: number) => works[Math.min(works.length - 1, Math.floor(p * works.length))];
      console.log(
        `[shape-regions] ${difficulty}: n=${subset.length} work p50=${pct(0.5)} p90=${pct(0.9)} ` +
          `max=${works[works.length - 1]} attempts max=${Math.max(...subset.map((r) => r.puzzle.attempts))}`,
      );
    }
    console.log(
      `[shape-regions] ${runs.length} boards: worst work=${worst.puzzle.work} (${worst.name}) ` +
        `— ms=${ms.toFixed(0)} for the whole walk (printed, not asserted)`,
    );
    expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
      WORK_BUDGET,
    );
  });

  it('rarely needs a derived seed, and never approaches the cap', () => {
    const worst = runs.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
    const retried = runs.filter((run) => run.puzzle.attempts > 1).length;
    console.log(
      `[shape-regions] ${retried}/${runs.length} boards needed a derived seed; ` +
        `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
    );
    expect(
      worst.puzzle.attempts,
      `${worst.name} took ${worst.puzzle.attempts}`,
    ).toBeLessThanOrEqual(ATTEMPT_BUDGET);
  });
});
