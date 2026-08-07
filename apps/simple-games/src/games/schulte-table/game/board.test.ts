import { describe, expect, it } from 'vitest';
import { generateBoard, isValidBoard } from './board';
import { SIZES } from './types';

describe('board generation (docs/SCHULTE_TABLE_RULES.md §6)', () => {
  it('holds 1..N² exactly once, at every size', () => {
    for (const size of SIZES) {
      for (let n = 1; n <= 40; n++) {
        expect(isValidBoard(generateBoard(`seed-${n}`, size), size)).toBe(true);
      }
    }
  });

  it('is deterministic per seed', () => {
    for (const size of SIZES) {
      expect(generateBoard('same', size)).toEqual(generateBoard('same', size));
    }
  });

  it('gives different seeds different boards', () => {
    // Not a guarantee of the algorithm — a shuffle may repeat — but across
    // twenty seeds on a 5x5 (25! arrangements) a collision would mean the seed
    // is not reaching the generator.
    const seen = new Set<string>();
    for (let n = 0; n < 20; n++) seen.add(generateBoard(`seed-${n}`, 5).join(','));
    expect(seen.size).toBe(20);
  });

  it('rejects a board that is not a permutation', () => {
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8, 8], 3)).toBe(false); // duplicate
    expect(isValidBoard([1, 2, 3, 4, 5, 6, 7, 8], 3)).toBe(false); // short
    expect(isValidBoard([0, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toBe(false); // out of range
  });
});
