import { describe, expect, it } from 'vitest';
import { generateBoard, generateInitialBoard } from './board';
import { COLS, INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { rowLayout, SHAPES, startingWidths } from './shapes';
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

  it('places about the requested number of live cells, all valued 1-9', () => {
    const board = generateInitialBoard('any-seed');
    // Whole rows only, so the count lands within a row of the target.
    expect(Math.abs(liveCount(board) - INITIAL_CELLS)).toBeLessThanOrEqual(COLS);
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
    // Small boards draw pair-less values often enough to exercise the retry
    // loop; the result must still be deterministic per seed and playable.
    for (let i = 0; i < 50; i++) {
      const seed = `tiny-${i}`;
      const a = generateBoard(seed, { cellCount: COLS });
      expect(a).toEqual(generateBoard(seed, { cellCount: COLS }));
      expect(liveCount(a)).toBe(COLS);
      expect(hasAnyMove(a)).toBe(true);
    }
  });
});

describe('generateBoard with a shape', () => {
  it('lays every shape out as whole rows of COLS slots', () => {
    for (const shape of SHAPES) {
      const board = generateBoard(`shaped-${shape.key}`, { shape, cellCount: 36 });
      expect(board.length % COLS).toBe(0);
      expect(liveCount(board)).toBe(
        startingWidths(shape, 36).reduce((sum, w) => sum + w, 0),
      );
    }
  });

  it('honours each row width, centered, with holes on the outside', () => {
    const shape = SHAPES.find((s) => s.key === 'diamond')!;
    const widths = startingWidths(shape, 30);
    const board = generateBoard('shape-widths', { shape, cellCount: 30 });
    widths.forEach((width, r) => {
      const row = board.slice(r * COLS, (r + 1) * COLS);
      const layout = rowLayout(width);
      row.forEach((cell, c) => {
        // Inside the band a number, outside it a hole — nothing half-filled.
        if (layout[c]) expect(cell).not.toBeNull();
        else expect(cell).toBeNull();
      });
    });
  });

  it('never ends on a half-filled row', () => {
    for (const shape of SHAPES) {
      for (const target of [15, 25, 33, 44, 63]) {
        const board = generateBoard(`whole-${shape.key}-${target}`, { shape, cellCount: target });
        const lastRow = board.slice(board.length - COLS);
        const width = startingWidths(shape, target).at(-1)!;
        expect(lastRow.filter((c) => c !== null)).toHaveLength(width);
      }
    }
  });

  it('a higher pair bias yields boards that are still playable', () => {
    for (const bias of [0, 0.3, 0.6]) {
      const board = generateBoard(`bias-${bias}`, { cellCount: 25, pairBias: bias });
      expect(hasAnyMove(board)).toBe(true);
    }
  });
});
