import { describe, expect, it } from 'vitest';
import { clampLevel, levelSeed, MAX_LEVEL, sizeForLevel, tilesForLevel } from './levels';
import { cellCount, SIZES } from './types';

describe('level ladder (docs/NUMBER_RECALL_RULES.md §7)', () => {
  it('clamps out-of-range levels rather than throwing', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(-5)).toBe(1);
    expect(clampLevel(999)).toBe(MAX_LEVEL);
  });

  it('matches the table in the rules at every band edge', () => {
    const rows: [number, number, number][] = [
      [1, 3, 3],
      [15, 3, 5],
      [16, 4, 5],
      [55, 4, 9],
      [56, 5, 9],
      [100, 5, 12],
    ];
    for (const [level, size, tiles] of rows) {
      expect([level, sizeForLevel(level), tilesForLevel(level)]).toEqual([level, size, tiles]);
    }
  });

  it('never asks for more tiles than the board has cells', () => {
    for (let level = 1; level <= MAX_LEVEL; level++) {
      expect(SIZES).toContain(sizeForLevel(level));
      expect(tilesForLevel(level)).toBeLessThanOrEqual(cellCount(sizeForLevel(level)));
      // Fewer tiles than cells, always: an empty cell is part of the question.
      expect(tilesForLevel(level)).toBeLessThan(cellCount(sizeForLevel(level)));
      expect(tilesForLevel(level)).toBeGreaterThanOrEqual(3);
    }
  });

  it('never gets easier as levels rise', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(sizeForLevel(level)).toBeGreaterThanOrEqual(sizeForLevel(level - 1));
      expect(tilesForLevel(level)).toBeGreaterThanOrEqual(tilesForLevel(level - 1));
    }
  });

  it('never steps the size up and the tile count up at once', () => {
    // §7: a new size opens on the tile count the previous band closed at, so
    // the size is the only thing that changed.
    for (let level = 2; level <= MAX_LEVEL; level++) {
      if (sizeForLevel(level) !== sizeForLevel(level - 1)) {
        expect(tilesForLevel(level)).toBe(tilesForLevel(level - 1));
      }
    }
  });

  it('gives each attempt at a level its own seed (§8)', () => {
    expect(levelSeed(7, 0)).toBe('recall-level-7-r0');
    expect(levelSeed(7, 1)).toBe('recall-level-7-r1');
    expect(levelSeed(7, 0)).not.toBe(levelSeed(7, 1));
    expect(levelSeed(101, 0)).toBe('recall-level-100-r0');
    expect(levelSeed(7, -3)).toBe('recall-level-7-r0');
  });
});
