import { describe, expect, it } from 'vitest';
import { generateLayout, indexOfTile, isValidLayout } from './layout';
import { cellCount, EMPTY, SIZES } from './types';

describe('layout generation (docs/NUMBER_RECALL_RULES.md §6)', () => {
  it('places exactly K tiles numbered 1..K, leaving the rest empty', () => {
    for (const size of SIZES) {
      for (const tiles of [3, 5, 9]) {
        if (tiles >= cellCount(size)) continue;
        const layout = generateLayout(`seed-${size}-${tiles}`, size, tiles);
        expect(isValidLayout(layout, size, tiles)).toBe(true);
        expect(layout.filter((v) => v === EMPTY)).toHaveLength(cellCount(size) - tiles);
      }
    }
  });

  it('is deterministic per seed', () => {
    expect(generateLayout('same', 4, 6)).toEqual(generateLayout('same', 4, 6));
  });

  it('gives different seeds different layouts', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 20; n++) seen.add(generateLayout(`seed-${n}`, 5, 9).join(','));
    expect(seen.size).toBe(20);
  });

  it('never asks for more tiles than the board holds', () => {
    // A caller passing nonsense gets a full board rather than a broken one.
    const layout = generateLayout('over', 3, 99);
    expect(isValidLayout(layout, 3, 9)).toBe(true);
    expect(layout.filter((v) => v === EMPTY)).toHaveLength(0);
  });

  it('finds a tile by its number', () => {
    const layout = generateLayout('find', 4, 6);
    for (let value = 1; value <= 6; value++) {
      expect(layout[indexOfTile(layout, value)]).toBe(value);
    }
    expect(indexOfTile(layout, 7)).toBe(-1);
  });

  it('rejects a layout that is not a clean 1..K', () => {
    expect(isValidLayout([1, 2, 2, 0, 0, 0, 0, 0, 0], 3, 3)).toBe(false); // duplicate
    expect(isValidLayout([1, 2, 0, 0, 0, 0, 0, 0, 0], 3, 3)).toBe(false); // missing 3
    expect(isValidLayout([1, 2, 4, 0, 0, 0, 0, 0, 0], 3, 3)).toBe(false); // out of range
    expect(isValidLayout([1, 2, 3], 3, 3)).toBe(false); // wrong length
  });
});
