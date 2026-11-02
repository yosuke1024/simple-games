import { describe, expect, it } from 'vitest';
import { diceOf, DISTINCT_ROLLS, rollFor } from './dice';

describe('rollFor (docs/BACKGAMMON_RULES.md §4)', () => {
  it('is deterministic: the same seed and index give the same two faces', () => {
    for (let index = 0; index < 50; index++) {
      expect(rollFor('backgammon-x', index)).toEqual(rollFor('backgammon-x', index));
    }
    expect(rollFor('backgammon-x', 3)).not.toEqual(rollFor('backgammon-y', 3));
  });

  it('only ever produces faces 1..6', () => {
    for (let index = 0; index < 2000; index++) {
      const [a, b] = rollFor('faces', index);
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(6);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(6);
      expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
    }
  });

  it('is uniform over the faces and independent between the two dice', () => {
    const faces = new Array<number>(7).fill(0);
    const pairs = new Map<string, number>();
    const n = 36000;
    for (let index = 0; index < n; index++) {
      const [a, b] = rollFor('uniform', index);
      faces[a]! += 1;
      faces[b]! += 1;
      const key = `${a}${b}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    for (let face = 1; face <= 6; face++) {
      // Expected 12,000 per face; a 5% band is ~8 standard deviations wide.
      expect(faces[face]).toBeGreaterThan(11400);
      expect(faces[face]).toBeLessThan(12600);
    }
    // Every ordered pair is seen about 1,000 times.
    expect(pairs.size).toBe(36);
    for (const count of pairs.values()) {
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });

  it('golden: the first rolls of a fixed seed never change (§4, §9)', () => {
    const rolls = Array.from({ length: 8 }, (_, index) => rollFor('backgammon-golden', index));
    expect(rolls).toMatchInlineSnapshot(`
      [
        [
          6,
          3,
        ],
        [
          6,
          6,
        ],
        [
          5,
          5,
        ],
        [
          3,
          2,
        ],
        [
          3,
          5,
        ],
        [
          3,
          5,
        ],
        [
          5,
          3,
        ],
        [
          5,
          3,
        ],
      ]
    `);
  });
});

describe('diceOf', () => {
  it('puts four dice on the table for doubles and two otherwise (§2.1)', () => {
    expect(diceOf([3, 3])).toEqual([3, 3, 3, 3]);
    expect(diceOf([6, 1])).toEqual([6, 1]);
  });
});

describe('DISTINCT_ROLLS', () => {
  it('lists the 21 distinct rolls with weights summing to 36 (§5.2)', () => {
    expect(DISTINCT_ROLLS).toHaveLength(21);
    expect(DISTINCT_ROLLS.reduce((sum, { weight }) => sum + weight, 0)).toBe(36);
    expect(DISTINCT_ROLLS.filter(({ roll }) => roll[0] === roll[1])).toHaveLength(6);
  });
});
