/**
 * The generator's steps of docs/LOOP_PUZZLE_RULES.md §8 on their own: the
 * region is hole-free and its boundary one loop, the numbers are that loop's
 * counts, thinning batches without changing the board (proven for a
 * monotone test, measured for the real one), the same seed is the same
 * board, the bundled fallback ships when nothing can meet a tier, and the
 * work budget bounds a whole generation — fallback included.
 */
import { describe, expect, it } from 'vitest';
import { isSingleLoop, isSolved, linesAround } from './engine';
import {
  ATTEMPT_LIMIT,
  GENERATION_WORK_LIMIT,
  TIERS,
  buildCandidate,
  cluesOfLoop,
  generateForTier,
  generatePuzzle,
  growRegion,
  loopOfRegion,
  meetsTier,
  thinClues,
} from './generator';
import { gridFor } from './grid';
import { createRng, shuffled } from './rng';
import { countSolutions, gradeOf, uniqueSolution } from './solver';
import { oracleCount } from './test-helpers';
import { DIFFICULTIES, LINE, PRESETS, type Clue } from './types';

/**
 * How far past GENERATION_WORK_LIMIT a whole generation may land (§8): the
 * budget is checked before each attempt, each thinning check, each search
 * node and each trial, so the overshoot is one region growth and one
 * propagation (measured at most about 1,100), plus the bundled board's own
 * check when the fallback ships (measured at most 3,448; bundled.test.ts
 * holds it under 4,000).
 */
const BUDGET_OVERSHOOT = 10_000;

describe('the region and its loop (§8, steps 1–2)', () => {
  it('grows to the target size, in one piece, with no hole — and its boundary is one loop', () => {
    for (const [w, h] of [
      [4, 4],
      [5, 5],
      [6, 6],
    ] as const) {
      const preset = { width: w, height: h };
      for (let i = 0; i < 60; i++) {
        const rng = createRng(`region-${w}-${i}`);
        const target = 2 + (i % (w * h - 2));
        const region = growRegion(preset, rng, target);
        expect(region.size).toBeLessThanOrEqual(target);
        expect(region.inside.filter(Boolean).length).toBe(region.size);
        const loop = loopOfRegion(preset, region.inside);
        expect(isSingleLoop({ ...preset, clues: [] }, loop), `${w}x${h} #${i}`).toBe(true);
        // The oracle's reading of "one loop" agrees: a blank board admits this one.
        const clues = cluesOfLoop(preset, loop);
        expect(Math.max(...clues)).toBeLessThanOrEqual(3);
        expect(isSolved({ ...preset, clues }, loop)).toBe(true);
      }
    }
  });

  it('reaches its target on the shipped sizes (holes are what stop a region early)', () => {
    let short = 0;
    for (let i = 0; i < 100; i++) {
      const region = growRegion(PRESETS.hard, createRng(`reach-${i}`), 18);
      if (region.size < 18) short++;
    }
    expect(short).toBe(0);
  });

  it('numbers every cell with its count of loop edges', () => {
    const preset = { width: 4, height: 4 };
    const inside = new Array<boolean>(16).fill(false);
    inside[5] = inside[6] = inside[10] = true; // an L of three cells
    const loop = loopOfRegion(preset, inside);
    const clues = cluesOfLoop(preset, loop);
    const grid = gridFor(4, 4);
    clues.forEach((clue, cell) => expect(clue).toBe(linesAround(grid, loop, cell)));
    expect(clues).toEqual([0, 1, 1, 0, 1, 3, 2, 1, 0, 2, 3, 1, 0, 0, 1, 0]);
    expect(loop.filter((m) => m === LINE)).toHaveLength(8);
  });
});

describe('thinning (§8, step 3)', () => {
  /** The plain definition: try each cell in order, keep the removal if it is accepted. */
  function oneByOne(
    clues: Clue[],
    order: readonly number[],
    target: number,
    accepts: (next: Clue[]) => boolean,
  ): Clue[] {
    let current = clues;
    let count = current.filter((c) => c !== null).length;
    for (const cell of order) {
      if (target > 0 && count <= target) break;
      if (current[cell] === null) continue;
      const next = [...current];
      next[cell] = null;
      if (!accepts(next)) continue;
      current = next;
      count--;
    }
    return current;
  }

  it('gives exactly the one-at-a-time result for a monotone test, any batch size, any target', () => {
    const rng = createRng('thin');
    for (let trial = 0; trial < 200; trial++) {
      const cells = 16 + Math.floor(rng() * 20);
      const clues: Clue[] = Array.from({ length: cells }, () => Math.floor(rng() * 4));
      // A monotone rule: some cells must keep a clue, and at least `floor` must remain.
      const required = new Set(
        shuffled([...clues.keys()], rng).slice(0, Math.floor(rng() * cells)),
      );
      const floor = Math.floor(rng() * cells);
      const accepts = (next: Clue[]): boolean =>
        [...required].every((cell) => next[cell] !== null) &&
        next.filter((c) => c !== null).length >= floor;
      const order = shuffled([...clues.keys()], rng);
      const target = rng() < 0.5 ? 0 : Math.floor(rng() * cells);
      const expected = oneByOne([...clues], order, target, accepts);
      for (const batch of [1, 2, 5, 8, 40]) {
        expect(thinClues([...clues], order, target, batch, accepts)).toEqual(expected);
      }
    }
  });
});

describe('thinning with the real acceptance test (§8, step 3)', () => {
  /**
   * The real test is not provably monotone — the T3 check is a node-limited
   * count plus a work-limited trial solve — so the equality above does not
   * carry over by argument. It is measured instead: the default batches and
   * batches of one give the same candidate on real seeds of every tier.
   */
  it('builds the same candidate with the default batches as with batches of one', () => {
    for (const difficulty of DIFFICULTIES) {
      let built = 0;
      for (let i = 0; i < 24; i++) {
        const seed = `batch-${difficulty}-${i}`;
        const batched = buildCandidate(seed, PRESETS[difficulty], TIERS[difficulty]);
        const single = buildCandidate(seed, PRESETS[difficulty], TIERS[difficulty], {
          batchSize: 1,
        });
        expect(single, seed).toEqual(batched);
        if (batched !== null) built++;
      }
      expect(built, difficulty).toBeGreaterThan(12);
    }
  });
});

describe('candidates and tiers (§7, §8)', () => {
  it('proves each candidate unique, on the loop it was grown from', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (let i = 0; i < 6; i++) {
        const candidate = buildCandidate(
          `cand-${difficulty}-${i}`,
          PRESETS[difficulty],
          TIERS[difficulty],
        );
        if (candidate === null) continue;
        expect(uniqueSolution(candidate.layout)).toEqual([...candidate.solution]);
        expect(oracleCount(candidate.layout).count).toBe(1);
        expect(candidate.grade).toBeLessThanOrEqual(TIERS[difficulty].level);
      }
    }
  });

  it('meets a tier only at its level and within its clue cap', () => {
    const candidate = buildCandidate('cand-medium-0', PRESETS.medium, TIERS.medium)!;
    expect(meetsTier(candidate, TIERS.medium)).toBe(true);
    expect(meetsTier({ ...candidate, grade: 1 }, TIERS.medium)).toBe(false);
    expect(meetsTier({ ...candidate, grade: 3 }, TIERS.medium)).toBe(false);
    expect(meetsTier(candidate, { ...TIERS.medium, clueMax: 1 })).toBe(false);
    // Easy asks for nothing beyond T1, so a T1 board is fine there.
    expect(meetsTier({ ...candidate, grade: 1 }, { ...TIERS.easy, clueMax: 99 })).toBe(true);
  });

  it('is deterministic: the same seed is the same puzzle, work and all', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const a = generatePuzzle(`repeat-${difficulty}`, difficulty);
      const b = generatePuzzle(`repeat-${difficulty}`, difficulty);
      expect(a).toEqual(b);
    }
    expect(generatePuzzle('repeat-a', 'medium').clues).not.toEqual(
      generatePuzzle('repeat-b', 'medium').clues,
    );
  });
});

/**
 * The escape hatch of §8 step 6, exercised on demand: no walked seed needs
 * it (guarantee.test.ts asserts zero fallbacks), so an impossible tier — no
 * board can carry fewer than one clue — is the only way to make every
 * derived seed miss and drive the code that ships a bundled board.
 */
describe('the bundled fallback (§8, step 6)', () => {
  it('ships a verified bundled board, marked fallback, when no seed can meet the tier', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const impossible = { ...TIERS[difficulty], clueMax: 0 };
      const puzzle = generateForTier(
        `fallback-${difficulty}`,
        PRESETS[difficulty],
        impossible,
        difficulty,
      );
      expect(puzzle.fallback).toBe(true);
      expect(puzzle.attempts).toBeGreaterThanOrEqual(1);
      expect(puzzle.attempts).toBeLessThanOrEqual(ATTEMPT_LIMIT);
      expect(puzzle.width).toBe(PRESETS[difficulty].width);
      expect(isSolved(puzzle, puzzle.solution)).toBe(true);
      expect(uniqueSolution(puzzle)).toEqual([...puzzle.solution]);
      expect(puzzle.grade).toBe(TIERS[difficulty].level);
    }
  });

  /**
   * The fallback is the safety net for the slowest case, so it must not be
   * the slowest path: it fires on whichever runs out first, ATTEMPT_LIMIT or
   * the work budget, and the whole call stays inside the budget plus its
   * overshoot. Without the budget a Hard call that misses every attempt
   * spent 1.0–1.8 million (§8).
   */
  it('bounds the fallback path by the work budget, on every tier', () => {
    for (const difficulty of DIFFICULTIES) {
      const impossible = { ...TIERS[difficulty], clueMax: 0 };
      for (let i = 0; i < 6; i++) {
        const seed = `budget-${difficulty}-${i}`;
        const puzzle = generateForTier(seed, PRESETS[difficulty], impossible, difficulty);
        expect(puzzle.fallback, seed).toBe(true);
        expect(puzzle.work, seed).toBeLessThanOrEqual(GENERATION_WORK_LIMIT + BUDGET_OVERSHOOT);
        const budgetSpent = puzzle.work >= GENERATION_WORK_LIMIT;
        expect(puzzle.attempts === ATTEMPT_LIMIT || budgetSpent, seed).toBe(true);
        // Hard runs out of budget long before it runs out of attempts.
        if (difficulty === 'hard') expect(puzzle.attempts, seed).toBeLessThan(ATTEMPT_LIMIT);
      }
    }
  });

  it('falls back on a real seed whose own boards cost more than the budget', () => {
    // Found in a 15,000-seed sample of minted-style Hard seeds (§8): its
    // first two derived seeds miss, and the third lands only past the budget.
    const seed = 'loop-puzzle-hard-mvjuk5zk--6d6nv';
    const unbudgeted = generateForTier(seed, PRESETS.hard, TIERS.hard, 'hard', Infinity);
    expect(unbudgeted.fallback).toBe(false);
    expect(unbudgeted.work).toBeGreaterThan(GENERATION_WORK_LIMIT);
    const shipped = generatePuzzle(seed, 'hard');
    expect(shipped.fallback).toBe(true);
    expect(shipped.work).toBeGreaterThanOrEqual(GENERATION_WORK_LIMIT);
    expect(shipped.work).toBeLessThanOrEqual(GENERATION_WORK_LIMIT + BUDGET_OVERSHOOT);
    expect(uniqueSolution(shipped)).toEqual([...shipped.solution]);
  });

  it('changes nothing for a board that lands inside the budget', () => {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 4; i++) {
        const seed = `inside-${difficulty}-${i}`;
        const shipped = generatePuzzle(seed, difficulty);
        expect(shipped.fallback, seed).toBe(false);
        expect(
          generateForTier(seed, PRESETS[difficulty], TIERS[difficulty], difficulty, Infinity),
        ).toEqual(shipped);
      }
    }
  });

  it('never ships a board the budget cut short: a tight budget only moves the fallback earlier', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const workLimit of [0, 2_000, 8_000, 30_000, 120_000]) {
        const puzzle = generateForTier(
          `tight-${difficulty}`,
          PRESETS[difficulty],
          TIERS[difficulty],
          difficulty,
          workLimit,
        );
        const name = `${difficulty} @ ${workLimit}`;
        expect(puzzle.work, name).toBeLessThanOrEqual(workLimit + BUDGET_OVERSHOOT);
        // Whatever ships is proven and graded on its own terms.
        const count = countSolutions(puzzle);
        expect(count, name).toMatchObject({ count: 1, complete: true });
        expect(count.solution, name).toEqual([...puzzle.solution]);
        expect(gradeOf(puzzle)?.grade, name).toBe(TIERS[difficulty].level);
        if (!puzzle.fallback)
          expect(meetsTier({ layout: puzzle, ...puzzle }, TIERS[difficulty])).toBe(true);
      }
    }
  });
});
