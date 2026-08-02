import { describe, expect, it } from 'vitest';
import { hasAnyMove } from './hint';
import { isDigit, isStone } from './types';
import {
  generateLevelBoard,
  initialCellsForLevel,
  levelSeed,
  MAX_LEVEL,
  pairBiasForLevel,
  stoneCountForLevel,
  wildCountForLevel,
} from './levels';

describe('level parameters', () => {
  it('grows the board gently from 25 to 63 cells', () => {
    expect(initialCellsForLevel(1)).toBe(25);
    expect(initialCellsForLevel(2)).toBe(25);
    expect(initialCellsForLevel(3)).toBe(26);
    expect(initialCellsForLevel(50)).toBe(25 + Math.floor(49 / 2));
    expect(initialCellsForLevel(77)).toBe(63);
    expect(initialCellsForLevel(MAX_LEVEL)).toBe(63);
  });

  it('lowers the pair bias linearly from 0.6 to 0.2', () => {
    expect(pairBiasForLevel(1)).toBeCloseTo(0.6);
    expect(pairBiasForLevel(MAX_LEVEL)).toBeCloseTo(0.2);
    expect(pairBiasForLevel(50)).toBeGreaterThan(pairBiasForLevel(51));
  });

  it('clamps out-of-range levels', () => {
    expect(levelSeed(0)).toBe('level-1');
    expect(levelSeed(101)).toBe(`level-${MAX_LEVEL}`);
    expect(initialCellsForLevel(-5)).toBe(25);
  });
});

describe('generateLevelBoard', () => {
  it('is deterministic per level (same board on every device)', () => {
    for (const level of [1, 2, 50, 77, 100]) {
      expect(generateLevelBoard(level)).toEqual(generateLevelBoard(level));
    }
  });

  it('differs between levels', () => {
    const values = (level: number) =>
      generateLevelBoard(level)
        .map((c) => (isDigit(c) ? c.value : '#'))
        .join('');
    expect(values(1)).not.toBe(values(2));
  });

  it('always starts playable with the configured size, at every difficulty band', () => {
    for (const level of [1, 10, 25, 40, 55, 70, 85, 100]) {
      const board = generateLevelBoard(level);
      // Whole rows only, so the size lands within a row of the target (§13).
      // The target counts slots, which is what stones and wilds occupy too.
      const occupied = board.filter((c) => c !== null).length;
      expect(Math.abs(occupied - initialCellsForLevel(level))).toBeLessThanOrEqual(9);
      expect(board.length % 9).toBe(0);
      expect(hasAnyMove(board)).toBe(true);
      // Nothing starts cleared, and every number is a real digit; stones and
      // wilds are counted separately in the decoration tests.
      for (const cell of board) {
        if (cell === null || cell.kind === 'stone') continue;
        expect(cell.cleared).toBe(false);
        if (!isDigit(cell)) continue;
        expect(cell.value).toBeGreaterThanOrEqual(1);
        expect(cell.value).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('stone and wild schedule (§16)', () => {
  it('keeps the earliest levels free of both, so the tutorial stays complete', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(wildCountForLevel(level)).toBe(0);
      expect(stoneCountForLevel(level)).toBe(0);
    }
  });

  it('introduces the wild before the stone', () => {
    // The wild only ever helps, so it teaches "special tile" without cost.
    expect(wildCountForLevel(6)).toBe(1);
    expect(stoneCountForLevel(14)).toBe(0);
    expect(stoneCountForLevel(15)).toBe(1);
  });

  it('adds a second wild halfway up, and no more', () => {
    expect(wildCountForLevel(54)).toBe(1);
    expect(wildCountForLevel(55)).toBe(2);
    expect(wildCountForLevel(MAX_LEVEL)).toBe(2);
  });

  it('adds stones one at a time, capped so a board stays playable', () => {
    expect(stoneCountForLevel(39)).toBe(1);
    expect(stoneCountForLevel(40)).toBe(2);
    expect(stoneCountForLevel(65)).toBe(3);
    expect(stoneCountForLevel(90)).toBe(4);
    expect(stoneCountForLevel(MAX_LEVEL)).toBe(4);
  });

  it('is monotonic: a later level never has fewer', () => {
    for (let level = 2; level <= MAX_LEVEL; level++) {
      expect(wildCountForLevel(level)).toBeGreaterThanOrEqual(wildCountForLevel(level - 1));
      expect(stoneCountForLevel(level)).toBeGreaterThanOrEqual(stoneCountForLevel(level - 1));
    }
  });

  it('puts the scheduled stones and wilds on the generated board', () => {
    for (const level of [6, 15, 25, 65, 100]) {
      const board = generateLevelBoard(level);
      expect(board.filter((c) => c?.kind === 'wild')).toHaveLength(wildCountForLevel(level));
      expect(board.filter(isStone)).toHaveLength(stoneCountForLevel(level));
    }
  });

  it('leaves all 100 levels playable, with room for every scheduled tile', () => {
    // Stones cut connections, so the whole ladder is swept rather than sampled:
    // one level that cannot fit its stones, or that starts with no move at all,
    // would otherwise only surface for the player who reached it.
    const shortfalls: string[] = [];
    for (let level = 1; level <= MAX_LEVEL; level++) {
      const board = generateLevelBoard(level);
      if (!hasAnyMove(board)) shortfalls.push(`L${level}: no opening move`);
      const stones = board.filter(isStone).length;
      const wilds = board.filter((c) => c?.kind === 'wild').length;
      if (stones !== stoneCountForLevel(level) || wilds !== wildCountForLevel(level)) {
        shortfalls.push(
          `L${level}: ${stones}/${stoneCountForLevel(level)} stones, ${wilds}/${wildCountForLevel(level)} wilds`,
        );
      }
    }
    expect(shortfalls).toEqual([]);
  });
});
