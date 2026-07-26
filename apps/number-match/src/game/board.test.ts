import { describe, expect, it } from 'vitest';
import { generateInitialBoard } from './board';
import { INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';

describe('generateInitialBoard', () => {
  it('is deterministic: the same seed produces the same board', () => {
    const a = generateInitialBoard('seed-alpha');
    const b = generateInitialBoard('seed-alpha');
    expect(a).toEqual(b);
  });

  it('produces different boards for different seeds', () => {
    const a = generateInitialBoard('seed-alpha');
    const b = generateInitialBoard('seed-beta');
    expect(a.map((c) => c.value).join('')).not.toBe(b.map((c) => c.value).join(''));
  });

  it('produces the configured number of live cells with values 1-9', () => {
    const board = generateInitialBoard('any-seed');
    expect(board.length).toBe(INITIAL_CELLS);
    for (const cell of board) {
      expect(cell.cleared).toBe(false);
      expect(cell.value).toBeGreaterThanOrEqual(1);
      expect(cell.value).toBeLessThanOrEqual(9);
    }
  });

  it('always starts with at least one valid move', () => {
    for (const seed of ['a', 'b', 'c', 'flight', '2026-01-01', 'daily-2026-07-26']) {
      expect(hasAnyMove(generateInitialBoard(seed))).toBe(true);
    }
  });
});
