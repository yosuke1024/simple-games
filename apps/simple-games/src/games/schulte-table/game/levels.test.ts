import { describe, expect, it } from 'vitest';
import { clampLevel, levelSeed, MAX_LEVEL, orderForLevel, sizeForLevel } from './levels';
import { SIZES } from './types';

describe('level ladder (docs/SCHULTE_TABLE_RULES.md §7)', () => {
  it('clamps out-of-range levels rather than throwing', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(999)).toBe(MAX_LEVEL);
    expect(clampLevel(7.8)).toBe(7);
  });

  it('gives every level a size and an order', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(SIZES).toContain(sizeForLevel(level));
      expect(['ascending', 'descending', 'oddThenEven']).toContain(orderForLevel(level));
    }
  });

  it('matches the table in the rules, band by band', () => {
    const rows: [number, number, string][] = [
      [1, 3, 'ascending'],
      [15, 3, 'ascending'],
      [16, 3, 'descending'],
      [20, 3, 'descending'],
      [21, 4, 'ascending'],
      [45, 4, 'ascending'],
      [46, 4, 'descending'],
      [55, 4, 'descending'],
      [56, 5, 'ascending'],
      [80, 5, 'ascending'],
      [81, 5, 'descending'],
      [90, 5, 'descending'],
      [91, 5, 'oddThenEven'],
      [100, 5, 'oddThenEven'],
    ];
    for (const [level, size, order] of rows) {
      expect([level, sizeForLevel(level), orderForLevel(level)]).toEqual([level, size, order]);
    }
  });

  it('never steps the size up and the order over at once', () => {
    // §7: a new size always starts on `ascending`, so the size jump is the only
    // thing that changed.
    for (let level = 2; level <= MAX_LEVEL; level++) {
      if (sizeForLevel(level) !== sizeForLevel(level - 1)) {
        expect(orderForLevel(level)).toBe('ascending');
      }
    }
  });

  it('never makes the board smaller as levels rise', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(sizeForLevel(level)).toBeGreaterThanOrEqual(sizeForLevel(level - 1));
    }
  });

  it('names a seed per level', () => {
    expect(levelSeed(1)).toBe('schulte-level-1');
    expect(levelSeed(100)).toBe('schulte-level-100');
    expect(levelSeed(101)).toBe('schulte-level-100');
  });
});
