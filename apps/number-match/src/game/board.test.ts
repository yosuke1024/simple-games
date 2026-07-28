import { describe, expect, it } from 'vitest';
import { generateBoard, generateInitialBoard } from './board';
import { COLS, INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { rowLayout, SHAPE_FAMILIES, widthAt } from './shapes';
import { isLive, type Board } from './types';

const liveCount = (board: Board): number => board.filter((c) => isLive(c)).length;

describe('generateInitialBoard', () => {
  it('is deterministic: the same seed produces the same board', () => {
    expect(generateInitialBoard('seed-alpha')).toEqual(generateInitialBoard('seed-alpha'));
  });

  it('produces different boards for different seeds', () => {
    const values = (seed: string) =>
      generateInitialBoard(seed)
        .map((c) => (c === null ? '#' : c.value))
        .join('');
    expect(values('seed-alpha')).not.toBe(values('seed-beta'));
  });

  it('places the requested number of live cells, all valued 1-9', () => {
    const board = generateInitialBoard('any-seed');
    expect(liveCount(board)).toBe(INITIAL_CELLS);
    for (const cell of board) {
      if (cell === null) continue;
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

  it('regenerates deterministically when the first draw has no valid pair', () => {
    // Tiny boards frequently draw pair-less values, exercising the retry
    // loop; the result must still be deterministic per seed and playable.
    for (let i = 0; i < 50; i++) {
      const seed = `tiny-${i}`;
      const a = generateBoard(seed, { cellCount: 2 });
      expect(a).toEqual(generateBoard(seed, { cellCount: 2 }));
      expect(liveCount(a)).toBe(2);
      expect(hasAnyMove(a)).toBe(true);
    }
  });
});

describe('generateBoard with a shape', () => {
  it('lays every shape out as whole rows of COLS slots', () => {
    for (const shape of SHAPE_FAMILIES) {
      const board = generateBoard(`shaped-${shape.join('-')}`, { shape, cellCount: 30 });
      expect(board.length % COLS).toBe(0);
      expect(liveCount(board)).toBe(30);
    }
  });

  it('honours each row width, centered, with holes on the outside', () => {
    const shape = [5, 9, 3];
    const board = generateBoard('shape-widths', { shape, cellCount: 17 });
    for (let r = 0; r < 3; r++) {
      const row = board.slice(r * COLS, (r + 1) * COLS);
      const layout = rowLayout(widthAt(shape, r));
      row.forEach((cell, c) => {
        // Outside the row's width there must be a hole.
        if (!layout[c]) expect(cell).toBeNull();
      });
    }
  });

  it('leaves the tail of the last row as holes when the numbers run out', () => {
    const board = generateBoard('short-tail', { cellCount: 10 });
    expect(board.length).toBe(2 * COLS);
    expect(liveCount(board)).toBe(10);
    expect(board.slice(10)).toEqual(Array.from({ length: 8 }, () => null));
  });

  it('a higher pair bias yields boards that are still playable', () => {
    for (const bias of [0, 0.3, 0.6]) {
      const board = generateBoard(`bias-${bias}`, { cellCount: 25, pairBias: bias });
      expect(hasAnyMove(board)).toBe(true);
    }
  });
});
