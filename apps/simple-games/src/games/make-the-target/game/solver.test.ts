/**
 * The counting enumeration of docs/MAKE_THE_TARGET_RULES.md §6「数え方」,
 * against small problems counted by hand (§15「列挙」).
 */
import { describe, expect, it } from 'vitest';
import { countWays } from './solver';
import { countsFor, slotLevelCounts } from './test-helpers';

const count = (numbers: number[], target: number) => countWays(numbers, target, 1e9);

describe('countWays (§6)', () => {
  it('no procedure: 0 ways', () => {
    expect(count([1, 1], 3)).toMatchObject({ capped: false, ways: 0, waysWithoutDivision: 0 });
    expect(count([2, 3, 5], 1000)).toMatchObject({ capped: false, ways: 0 });
  });

  it('one procedure', () => {
    expect(count([2, 3], 6)).toMatchObject({ ways: 1, waysWithoutDivision: 1 });
    // 3 − 2 only: 2 − 3 and 3 ÷ 2 are not legal.
    expect(count([2, 3], 1)).toMatchObject({ ways: 1, waysWithoutDivision: 1 });
  });

  it('÷ required and ÷ not required', () => {
    expect(count([3, 6], 2)).toMatchObject({ ways: 1, waysWithoutDivision: 0 });
    // 2 ÷ 2 only (2 − 2 is 0).
    expect(count([2, 2], 1)).toMatchObject({ ways: 1, waysWithoutDivision: 0 });
  });

  it('two tiles of one value are not told apart; two operators are two moves', () => {
    // 1 + 1 only, however the two 1s are picked.
    expect(count([1, 1], 2)).toMatchObject({ ways: 1, waysWithoutDivision: 1 });
    // 1 × 1 and 1 ÷ 1.
    expect(count([1, 1], 1)).toMatchObject({ ways: 2, waysWithoutDivision: 1 });
    // 2 + 2 and 2 × 2.
    expect(count([2, 2], 4)).toMatchObject({ ways: 2, waysWithoutDivision: 2 });
  });

  it('1, 2, 3 to 6: 9 procedures, 6 without ÷ (counted by hand)', () => {
    // 1+2→{3,3}: 3+3 | 2×1→{2,3}: 2×3 | 2÷1→{2,3}: 2×3 | 1+3→{2,4}: 2+4 |
    // 3×1→{2,3}: 2×3 | 3÷1→{2,3}: 2×3 | 2+3→{1,5}: 1+5 | 2×3→{1,6}: 6×1, 6÷1.
    expect(count([1, 2, 3], 6)).toMatchObject({ ways: 9, waysWithoutDivision: 6 });
  });

  it('1, 2, 3, 4 to 21: the six procedures of §6', () => {
    // 1+2・3+4・3×7 / 3+4・1+2・3×7 / 1+4・2+5・3×7 /
    // 2+3・4×5・1+20 / 2+4・1+6・3×7 / 2×4・8−1・3×7
    expect(count([1, 2, 3, 4], 21)).toEqual({
      capped: false,
      ways: 6,
      waysWithoutDivision: 6,
      states: 61,
    });
    // The tile-level oracle sees the same six value sequences.
    expect(countsFor(slotLevelCounts([1, 2, 3, 4]), 21)).toEqual({
      ways: 6,
      waysWithoutDivision: 6,
    });
  });

  it('two independent merges in either order are two procedures', () => {
    const paths = slotLevelCounts([1, 2, 3, 4]).paths!.get(21)!;
    expect(paths.has('2+1|4+3|7*3')).toBe(true);
    expect(paths.has('4+3|2+1|7*3')).toBe(true);
    // 1, 1, 2, 2 to 8: (1+1)×(2+2) in both orders, and nothing else
    // separates the two 1s or the two 2s.
    const eight = slotLevelCounts([1, 1, 2, 2]).paths!.get(8)!;
    expect(eight.has('1+1|2+2|4*2')).toBe(true);
    expect(eight.has('2+2|1+1|4*2')).toBe(true);
    expect(count([1, 1, 2, 2], 8)).toMatchObject({ ways: eight.size });
  });

  it('a value sequence two expressions share is counted once', () => {
    // [1+2, 3+4, 3×7] is (1+2)×(3+4) and ((1+2)+4)×3 at once: one sequence.
    const paths = [...slotLevelCounts([1, 2, 3, 4]).paths!.get(21)!].sort();
    expect(paths).toEqual(
      [
        '2+1|4+3|7*3',
        '3+2|5*4|20+1',
        '4*2|8-1|7*3',
        '4+1|5+2|7*3',
        '4+2|6+1|7*3',
        '4+3|2+1|7*3',
      ].sort(),
    );
  });

  it('does not depend on the order the numbers come in', () => {
    expect(count([4, 3, 2, 1], 21)).toEqual(count([1, 2, 3, 4], 21));
  });
});

describe('the work bound (§6)', () => {
  it('expands at most `budget` states and returns no counts when it stops', () => {
    expect(countWays([1, 2, 3, 4], 21, 61)).toMatchObject({ capped: false, states: 61 });
    const cut = countWays([1, 2, 3, 4], 21, 60);
    expect(cut).toEqual({ capped: true, states: 60 });
    expect('ways' in cut).toBe(false);
    expect(countWays([1, 2, 3, 4], 21, 5)).toEqual({ capped: true, states: 5 });
  });

  it('a fractional budget acts as its whole part: never past it', () => {
    expect(countWays([1, 2, 3, 4], 21, 1.5)).toEqual({ capped: true, states: 1 });
    expect(countWays([1, 2, 3, 4], 21, 2.5)).toEqual({ capped: true, states: 2 });
    expect(countWays([1, 2, 3, 4], 21, 60.9)).toEqual({ capped: true, states: 60 });
    expect(countWays([1, 2, 3, 4], 21, 61.5)).toMatchObject({ capped: false, states: 61 });
  });

  it('counts nothing for a budget below 1 or NaN', () => {
    for (const budget of [0, 0.5, -1, NaN, -Infinity]) {
      expect(countWays([1, 2, 3, 4], 21, budget)).toEqual({ capped: true, states: 0 });
    }
  });

  it('a single number needs no expansion', () => {
    expect(countWays([7], 7, 1)).toEqual({
      capped: false,
      ways: 1,
      waysWithoutDivision: 1,
      states: 0,
    });
  });
});
