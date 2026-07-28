import { describe, expect, it } from 'vitest';
import { hasAnyMove } from './hint';
import { isLive } from './types';
import {
  generateLevelBoard,
  initialCellsForLevel,
  levelSeed,
  MAX_LEVEL,
  pairBiasForLevel,
} from './levels';

describe('level parameters', () => {
  it('grows the board gently from 25 to 63 cells', () => {
    expect(initialCellsForLevel(1)).toBe(25);
    expect(initialCellsForLevel(25)).toBe(25);
    expect(initialCellsForLevel(26)).toBe(26);
    expect(initialCellsForLevel(500)).toBe(25 + Math.floor(499 / 25));
    expect(initialCellsForLevel(999)).toBe(63);
  });

  it('lowers the pair bias linearly from 0.6 to 0.2', () => {
    expect(pairBiasForLevel(1)).toBeCloseTo(0.6);
    expect(pairBiasForLevel(999)).toBeCloseTo(0.2);
    expect(pairBiasForLevel(500)).toBeGreaterThan(pairBiasForLevel(501));
  });

  it('clamps out-of-range levels', () => {
    expect(levelSeed(0)).toBe('level-1');
    expect(levelSeed(1000)).toBe(`level-${MAX_LEVEL}`);
    expect(initialCellsForLevel(-5)).toBe(25);
  });
});

describe('generateLevelBoard', () => {
  it('is deterministic per level (same board on every device)', () => {
    for (const level of [1, 2, 50, 500, 999]) {
      expect(generateLevelBoard(level)).toEqual(generateLevelBoard(level));
    }
  });

  it('differs between levels', () => {
    const values = (level: number) =>
      generateLevelBoard(level)
        .map((c) => (c === null ? '#' : c.value))
        .join('');
    expect(values(1)).not.toBe(values(2));
  });

  it('always starts playable with the configured size, at every difficulty band', () => {
    for (const level of [1, 100, 250, 400, 550, 700, 850, 999]) {
      const board = generateLevelBoard(level);
      expect(board.filter((c) => isLive(c))).toHaveLength(initialCellsForLevel(level));
      expect(hasAnyMove(board)).toBe(true);
      for (const cell of board) {
        if (cell === null) continue;
        expect(cell.cleared).toBe(false);
        expect(cell.value).toBeGreaterThanOrEqual(1);
        expect(cell.value).toBeLessThanOrEqual(9);
      }
    }
  });
});
