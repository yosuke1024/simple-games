/**
 * The persisted jump list's shape (docs/PEG_SOLITAIRE_RULES.md §11). Whether
 * the jumps were legal is the replay's question (session.test.ts); this is
 * only what a list of [from, to] pairs may look like.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, TRIANGLE } from './boards';
import { decodeJumps, encodeJumps, maxJumps } from './serialize';

describe('the jump list (§11)', () => {
  it('stores a jump as [from, to] and reads it back', () => {
    const jumps = [
      { from: 4, over: 9, to: 16 },
      { from: 11, over: 10, to: 9 },
    ];
    const stored = encodeJumps(jumps);
    expect(stored).toEqual([
      [4, 16],
      [11, 9],
    ]);
    expect(decodeJumps(JSON.parse(JSON.stringify(stored)), ENGLISH)).toEqual(stored);
    expect(decodeJumps([], TRIANGLE)).toEqual([]);
  });

  it('holds at most holes − 2 jumps: 31 on the cross, 13 on the triangle', () => {
    expect(maxJumps(ENGLISH)).toBe(31);
    expect(maxJumps(TRIANGLE)).toBe(13);
    const pairs = (n: number) => Array.from({ length: n }, () => [0, 2]);
    expect(decodeJumps(pairs(13), TRIANGLE)).toHaveLength(13);
    expect(decodeJumps(pairs(14), TRIANGLE)).toBeNull();
    expect(decodeJumps(pairs(31), ENGLISH)).toHaveLength(31);
    expect(decodeJumps(pairs(32), ENGLISH)).toBeNull();
  });

  it('refuses anything that is not a list of hole pairs', () => {
    for (const value of [
      null,
      undefined,
      '[[4,16]]',
      42,
      { length: 1, 0: [4, 16] },
      [null],
      [[4, 16, 9]],
      [[4]],
      [['4', 16]],
      [[4, 16.5]],
      [[4, Number.NaN]],
      [[-1, 2]],
      [[0, 15]],
    ]) {
      expect(decodeJumps(value, TRIANGLE), JSON.stringify(value)).toBeNull();
    }
    // 15 is not a triangle hole, but it is a cross hole.
    expect(decodeJumps([[0, 15]], ENGLISH)).toEqual([[0, 15]]);
  });
});
