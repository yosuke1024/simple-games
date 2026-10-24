/**
 * The generator of docs/MAKE_THE_TARGET_RULES.md §6–§7, piece by piece:
 * determinism, the draws, the solution built first, the ÷ round, the work
 * bound and the fallback. The 1,000-seed quality walks are quality.*.test.ts;
 * the seed goldens are compatibility.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_PROBLEMS } from './bundled';
import { replay } from './engine';
import {
  buildSolution,
  bundledFor,
  DIVISION_ROUND_SHARE,
  drawNumbers,
  generateFresh,
  generateProblem,
  isDivisionRound,
  WORK_LIMIT,
} from './generator';
import { createRng, hashSeed } from './rng';
import { countWays } from './solver';
import { isDealableShape, TIERS } from './tiers';
import { DIFFICULTIES } from './types';

describe('determinism (§6)', () => {
  it('the same seed gives the same problem, the same work and the same attempts', () => {
    for (const difficulty of DIFFICULTIES) {
      const seed = `make-the-target-${difficulty}-determinism`;
      expect(generateProblem(seed, difficulty)).toEqual(generateProblem(seed, difficulty));
    }
  });

  it('different seeds give different problems', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 50; k++) {
      const { problem } = generateProblem(`make-the-target-easy-d${k}`, 'easy');
      seen.add(`${problem.numbers}=${problem.target}`);
    }
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('the draws (§6 step 2)', () => {
  it('every tier deals its own shape', () => {
    for (const difficulty of DIFFICULTIES) {
      const counts = new Set<number>();
      for (let k = 0; k < 300; k++) {
        const numbers = drawNumbers(createRng(`draw-${difficulty}-${k}`), TIERS[difficulty]);
        counts.add(numbers.length);
        // Any target in the band: only the numbers are being checked.
        expect(isDealableShape(difficulty, numbers, TIERS[difficulty].targetRange[0])).toBe(true);
      }
      expect([...counts].sort()).toEqual([...TIERS[difficulty].tileCounts]);
    }
  });

  it('Hard draws one or two large numbers, both often', () => {
    const large = [0, 0, 0];
    for (let k = 0; k < 400; k++) {
      const numbers = drawNumbers(createRng(`hard-large-${k}`), TIERS.hard);
      large[numbers.filter((v) => v > 10).length]!++;
    }
    expect(large[0]).toBe(0);
    expect(large[1]).toBeGreaterThan(150);
    expect(large[2]).toBeGreaterThan(150);
  });
});

describe('the solution is built first (§6 step 3)', () => {
  it('is n−1 legal moves over the dealt slots, its last value the candidate target', () => {
    for (let k = 0; k < 300; k++) {
      const rng = createRng(`build-${k}`);
      const numbers = drawNumbers(rng, TIERS.medium);
      const { moves, value } = buildSolution(
        rng,
        numbers,
        TIERS.medium.buildOperators,
        k % 2 === 0,
      );
      expect(moves).toHaveLength(numbers.length - 1);
      const replayed = replay(numbers, moves)!;
      expect(replayed.slots.filter((v) => v !== null)).toEqual([value]);
      // The larger value is always on the left.
      for (const step of replayed.expressions) expect(step.left).toBeGreaterThanOrEqual(step.right);
    }
  });

  it('Easy builds with + − × only', () => {
    for (let k = 0; k < 200; k++) {
      const rng = createRng(`easy-build-${k}`);
      const numbers = drawNumbers(rng, TIERS.easy);
      const { moves } = buildSolution(rng, numbers, TIERS.easy.buildOperators, false);
      expect(moves.some((m) => m.op === '/')).toBe(false);
    }
  });

  it('a ÷ round takes ÷ about half the time it is first legal', () => {
    let offered = 0;
    let taken = 0;
    for (let k = 0; k < 2_000; k++) {
      const rng = createRng(`div-build-${k}`);
      // Two equal numbers: ÷ is legal on the first (and only) merge.
      const { moves } = buildSolution(rng, [6, 6], TIERS.medium.buildOperators, true);
      offered++;
      if (moves[0]!.op === '/') taken++;
    }
    expect(taken / offered).toBeGreaterThan(0.45);
    expect(taken / offered).toBeLessThan(0.55);
  });
});

describe('Medium’s ÷ round (§7)', () => {
  it('about a third of Medium seeds are ÷ rounds; no other tier has them', () => {
    let rounds = 0;
    for (let k = 0; k < 3_000; k++) if (isDivisionRound(`round-${k}`, 'medium')) rounds++;
    expect(rounds / 3_000).toBeGreaterThan(DIVISION_ROUND_SHARE - 0.03);
    expect(rounds / 3_000).toBeLessThan(DIVISION_ROUND_SHARE + 0.03);
    for (let k = 0; k < 100; k++) {
      expect(isDivisionRound(`round-${k}`, 'easy')).toBe(false);
      expect(isDivisionRound(`round-${k}`, 'hard')).toBe(false);
    }
  });

  it('a ÷ round ships only problems ÷ is required for; any other round only ≤ 200 ways', () => {
    for (let k = 1; k <= 120; k++) {
      const made = generateProblem(`make-the-target-medium-round-${k}`, 'medium');
      if (made.fallback) continue;
      if (made.divisionRound) expect(made.waysWithoutDivision).toBe(0);
      else expect(made.ways).toBeLessThanOrEqual(200);
    }
  });
});

describe('the work bound (§6 step 7)', () => {
  it('spends 1 per attempt plus the states each count expands, never past the budget', () => {
    const seed = 'make-the-target-hard-work';
    const made = generateProblem(seed, 'hard');
    // Recount the attempts by hand from the same seed's attempt rngs.
    let work = 0;
    for (let k = 0; k < made.attempts; k++) {
      const rng = createRng(`${seed}#${k}`);
      const numbers = drawNumbers(rng, TIERS.hard);
      const { value } = buildSolution(rng, numbers, TIERS.hard.buildOperators, false);
      work++;
      const [min, max] = TIERS.hard.targetRange;
      if (value < min || value > max) continue;
      work += countWays(numbers, value, Infinity).states;
    }
    expect(made.work).toBe(work);
    expect(made.work).toBeLessThanOrEqual(WORK_LIMIT);
  });

  it('falls back to a bundled problem once the budget is spent, chosen by the seed', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const budget of [1, 2, 10]) {
        const seed = `make-the-target-${difficulty}-tiny-${budget}`;
        const made = generateProblem(seed, difficulty, budget);
        expect(made.fallback).toBe(true);
        // The bundled problem was not built in this seed's round.
        expect(made.divisionRound).toBe(false);
        expect(made.work).toBeLessThanOrEqual(budget);
        const table = BUNDLED_PROBLEMS[difficulty];
        const entry = table[hashSeed(seed) % table.length]!;
        expect(bundledFor(seed, difficulty)).toBe(entry);
        expect(made.problem.numbers).toEqual(entry.numbers);
        expect(made.problem.target).toBe(entry.target);
        expect([made.ways, made.waysWithoutDivision]).toEqual([
          entry.ways,
          entry.waysWithoutDivision,
        ]);
      }
    }
  });

  it('a fallback from a ÷-round seed does not report a ÷ round (§6 step 8)', () => {
    let rounds = 0;
    for (let k = 0; k < 60; k++) {
      const seed = `make-the-target-medium-spent-${k}`;
      if (!isDivisionRound(seed, 'medium')) continue;
      rounds++;
      const made = generateProblem(seed, 'medium', 3);
      expect(made).toMatchObject({ fallback: true, divisionRound: false });
    }
    expect(rounds).toBeGreaterThan(5);
  });

  it('a budget of 0 or NaN draws nothing and falls back', () => {
    for (const budget of [0, NaN, -5]) {
      const made = generateProblem('make-the-target-easy-none', 'easy', budget);
      expect(made).toMatchObject({ fallback: true, work: 0, attempts: 0 });
    }
  });

  it('generateFresh reports the spent budget instead of guessing', () => {
    const made = generateFresh('make-the-target-medium-fresh', 'medium', 3);
    expect(made.problem).toBeNull();
    expect(made.work).toBeLessThanOrEqual(3);
  });
});
