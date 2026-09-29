/**
 * The promises of docs/BOX_REGIONS_RULES.md §1 and §7–§8, measured rather
 * than assumed: every puzzle that ships is unique, is graded to its tier by
 * the technique solver, is thinned as its tier says, is deterministic, never
 * falls back, keeps to 26 boxes, two 1×1s and areas 1–12, and stays inside
 * its work budget.
 *
 * Forty fixed seeds per tier plus two years of dailies are walked, not
 * sampled: difficulty seeds are minted at play time and cannot all be
 * walked, so a fixed set stands in for them, while the dailies are the exact
 * boards every player will see.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, DAILY_DIFFICULTY } from './daily';
import { initialAssignment, isSolved, regionCells, regionSatisfiesClue } from './engine';
import { ATTEMPT_LIMIT, TIERS, generatePuzzle, type GeneratedPuzzle } from './generator';
import { rectCells, rectOfCells } from './rects';
import { countSolutions, solve } from './solver';
import {
  DIFFICULTIES,
  MAX_REGIONS,
  MAX_REGION_SIZE,
  MAX_UNIT_REGIONS,
  type Difficulty,
  type Layout,
} from './types';

/**
 * Placements checked plus search nodes per board (`solverWork`), per tier.
 * Measured on this walk (the table in §8): easy under 450, medium under
 * 5,500, hard under 200,000, the dailies under 6,500. Each budget sits at
 * roughly 3–3.5× its worst case. A regression gate, not a device promise —
 * what it catches is a counter that stops propagating, a solver that re-reads
 * the full placement table each round, or a tier whose hit rate collapsed.
 */
const WORK_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 1_500,
  medium: 20_000,
  hard: 600_000,
  daily: 20_000,
};

/**
 * Derived seeds one board may cost (§8). Measured: easy and medium land on
 * the first seed or the second; hard, which needs T4 and has to be found,
 * takes up to 21 on this walk. The cap is ATTEMPT_LIMIT (60) and this budget
 * sits well short of it, so a tier drifting up here is a warning long before
 * anything falls back.
 */
const ATTEMPT_BUDGET: Record<Difficulty | 'daily', number> = {
  easy: 4,
  medium: 4,
  hard: 40,
  daily: 6,
};

const SEEDS_PER_TIER = 40;
const DAILY_DAYS = 730;

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
      const seed = `box-regions-${difficulty}-g${n}`;
      runs.push(timed(seed, difficulty, difficulty, seed));
    }
  }
  let date = '2026-08-01';
  for (let day = 0; day < DAILY_DAYS; day++) {
    runs.push(timed(`daily ${date}`, DAILY_DIFFICULTY, 'daily', dailySeed(date)));
    date = addDays(date, 1);
  }
  return { runs, ms: performance.now() - started };
}

const { runs, ms } = walk();
const GROUPS = [...DIFFICULTIES, 'daily'] as const;

describe('unique, tier-graded generation (§7, §8)', () => {
  it('ships a legal partition into boxes as the answer on every board (§1, §3)', () => {
    for (const { name, puzzle } of runs) {
      expect(isSolved(puzzle, puzzle.solution), `${name} answer breaks a rule`).toBe(true);
      expect(puzzle.clues.length, name).toBeLessThanOrEqual(MAX_REGIONS);
      const areas = puzzle.clues.map((_, region) => regionCells(puzzle.solution, region).length);
      expect(Math.min(...areas), name).toBeGreaterThanOrEqual(1);
      expect(Math.max(...areas), name).toBeLessThanOrEqual(MAX_REGION_SIZE);
      expect(areas.filter((area) => area === 1).length, name).toBeLessThanOrEqual(MAX_UNIT_REGIONS);
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

  it('thins clues as far as its tier asks, and no further (§7)', () => {
    for (const { name, difficulty, puzzle } of runs) {
      const n = puzzle.clues.length;
      const tier = TIERS[difficulty];
      const thinned = puzzle.clues.filter((c) => c.size === null || c.kind === 'free').length;
      const bare = puzzle.clues.filter((c) => c.size === null && c.kind === 'free').length;
      expect(thinned, name).toBe(puzzle.reducedCount);
      expect(bare, name).toBe(puzzle.bareCount);
      expect(puzzle.reducedCount, `${name} thinned too few`).toBeGreaterThanOrEqual(
        tier.reduceFloor(n),
      );
      expect(puzzle.reducedCount, `${name} thinned too many`).toBeLessThanOrEqual(
        tier.reduceTarget(n),
      );
      // Easy: at most a quarter, one side each, never down to a bare `free`.
      if (difficulty === 'easy') expect(bare, name).toBe(0);
    }
  });

  it('never falls back to a board short of its tier', () => {
    for (const { name, puzzle } of runs) {
      expect(puzzle.fallback, `${name} fell back`).toBe(false);
    }
  });

  it('is deterministic: the same seed is the same puzzle', () => {
    const a = generatePuzzle('box-regions-repeat', 'medium');
    const b = generatePuzzle('box-regions-repeat', 'medium');
    expect(a.solution).toEqual(b.solution);
    expect(a.clues).toEqual(b.clues);
    expect(a.attempts).toBe(b.attempts);
    expect(a.work).toBe(b.work);
    const again = generatePuzzle('box-regions-hard-g7', 'hard');
    expect(again.clues).toEqual(
      runs.find((run) => run.name === 'box-regions-hard-g7')!.puzzle.clues,
    );
  });
});

/**
 * Every rectangle on the board whose cells keep a clue's rules, read straight
 * from `regionSatisfiesClue` over every rectangle the board holds — never
 * from `enumeratePlacements`, whose loops `countSolutions` is built on. The
 * generator's own uniqueness proof re-checked with its own candidate list
 * could not catch a drift between the rules (engine.ts) and the list
 * (placements.ts), such as a size bound applied in one and not the other.
 */
function rulesBasedPlacements(layout: Layout, region: number): number[][] {
  const out: number[][] = [];
  for (let top = 0; top < layout.height; top++) {
    for (let left = 0; left < layout.width; left++) {
      for (let height = 1; top + height <= layout.height; height++) {
        for (let width = 1; left + width <= layout.width; width++) {
          const cells = rectCells({ top, left, width, height }, layout.width);
          if (regionSatisfiesClue(cells, layout, region)) out.push(cells);
        }
      }
    }
  }
  return out;
}

/** Exact cover over `rulesBasedPlacements`, driven by the first uncovered cell, up to `limit`. */
function rulesBasedSolutionCount(layout: Layout, limit: number): number {
  const cellCount = layout.width * layout.height;
  const perRegion = layout.clues.map((_, region) => rulesBasedPlacements(layout, region));
  const taken = new Array<boolean>(cellCount).fill(false);
  const placed = new Array<boolean>(layout.clues.length).fill(false);
  let found = 0;
  const cover = (): void => {
    if (found >= limit) return;
    const cell = taken.indexOf(false);
    if (cell === -1) {
      if (placed.every(Boolean)) found++;
      return;
    }
    for (let region = 0; region < perRegion.length; region++) {
      if (placed[region]) continue;
      for (const cells of perRegion[region]!) {
        if (found >= limit) return;
        if (!cells.includes(cell) || cells.some((c) => taken[c])) continue;
        for (const c of cells) taken[c] = true;
        placed[region] = true;
        cover();
        placed[region] = false;
        for (const c of cells) taken[c] = false;
      }
    }
  };
  cover();
  return found;
}

describe('an independent rules-only oracle agrees with countSolutions (§3, §7, §8)', () => {
  it('finds the same uniqueness on every walked board, from its own reading of the rules', () => {
    for (const { name, puzzle } of runs) {
      expect(rulesBasedSolutionCount(puzzle, 2), name).toBe(1);
      // Every answer box is one rectangle, read without the engine.
      const boxes = puzzle.clues.map((_, r) =>
        rectOfCells(regionCells(puzzle.solution, r), puzzle.width),
      );
      expect(
        boxes.every((box) => box !== null),
        name,
      ).toBe(true);
    }
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
  const pct = (sorted: readonly number[], p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;

  it('stays inside the work budget on every board', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const works = subset.map((run) => run.puzzle.work).sort((a, b) => a - b);
      const times = subset.map((run) => run.ms).sort((a, b) => a - b);
      const reduced = subset.map((run) => run.puzzle.reducedCount / run.puzzle.clues.length);
      const worst = subset.reduce((a, b) => (b.puzzle.work > a.puzzle.work ? b : a));
      console.log(
        `[box-regions] ${group}: n=${subset.length} work p50=${pct(works, 0.5)} ` +
          `p90=${pct(works, 0.9)} max=${works[works.length - 1]} ` +
          `attempts max=${Math.max(...subset.map((r) => r.puzzle.attempts))} ` +
          `fallback=${subset.filter((r) => r.puzzle.fallback).length} ` +
          `thinned mean=${(reduced.reduce((a, b) => a + b, 0) / reduced.length).toFixed(2)} ` +
          `ms p50=${pct(times, 0.5).toFixed(1)} max=${times[times.length - 1]!.toFixed(1)}`,
      );
      expect(worst.puzzle.work, `worst work ${worst.puzzle.work} at ${worst.name}`).toBeLessThan(
        WORK_BUDGET[group],
      );
    }
    console.log(`[box-regions] ${runs.length} boards — ms=${ms.toFixed(0)} for the whole walk`);
  });

  it('rarely needs a derived seed, and never approaches the cap', () => {
    for (const group of GROUPS) {
      const subset = runs.filter((run) => run.group === group);
      const worst = subset.reduce((a, b) => (b.puzzle.attempts > a.puzzle.attempts ? b : a));
      const retried = subset.filter((run) => run.puzzle.attempts > 1).length;
      console.log(
        `[box-regions] ${group}: ${retried}/${subset.length} boards needed a derived seed; ` +
          `worst ${worst.puzzle.attempts} (${worst.name}) of ${ATTEMPT_LIMIT}`,
      );
      expect(
        worst.puzzle.attempts,
        `${worst.name} took ${worst.puzzle.attempts}`,
      ).toBeLessThanOrEqual(ATTEMPT_BUDGET[group]);
    }
  });
});
