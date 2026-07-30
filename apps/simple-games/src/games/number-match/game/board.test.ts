import { describe, expect, it } from 'vitest';
import { generateBoard, generateInitialBoard } from './board';
import { COLS, INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { rowLayout, SHAPES, startingWidths } from './shapes';
import { isDigit, isLive, isStone, type Board } from './types';

const liveCount = (board: Board): number => board.filter((c) => isLive(c)).length;

describe('generateInitialBoard', () => {
  it('is deterministic: the same seed produces the same board', () => {
    expect(generateInitialBoard('seed-alpha')).toEqual(generateInitialBoard('seed-alpha'));
  });

  it('produces different boards for different seeds', () => {
    const values = (seed: string) =>
      generateInitialBoard(seed)
        .map((c) => (isDigit(c) ? c.value : '#'))
        .join('');
    expect(values('seed-alpha')).not.toBe(values('seed-beta'));
  });

  it('places about the requested number of live cells, all valued 1-9', () => {
    const board = generateInitialBoard('any-seed');
    // Whole rows only, so the count lands within a row of the target.
    expect(Math.abs(liveCount(board) - INITIAL_CELLS)).toBeLessThanOrEqual(COLS);
    // No stones or wilds were asked for, so every occupied slot is a number.
    const numbers = board.filter(isDigit);
    expect(numbers).toHaveLength(board.filter((c) => c !== null).length);
    for (const cell of numbers) {
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

describe('generateBoard with stones and wilds', () => {
  const rowsOf = (board: Board) =>
    Array.from({ length: Math.ceil(board.length / COLS) }, (_, r) =>
      board.slice(r * COLS, (r + 1) * COLS),
    );

  it('paints wilds over a board that is otherwise unchanged', () => {
    // Decorations are chosen by an rng of their own and painted over finished
    // cells, so asking for them must not move any other number. A wild can
    // only add moves — it pairs with anything — so the playability retry lands
    // on the same draw either way, which makes the two boards comparable slot
    // by slot. (Stones can cost a retry, so they are tested separately.)
    for (const seed of ['paint-a', 'paint-b', 'paint-c']) {
      const options = { cellCount: 36, pairBias: 0.4 };
      const plain = generateBoard(seed, options);
      const decorated = generateBoard(seed, { ...options, wildCount: 2 });
      expect(decorated).toHaveLength(plain.length);
      expect(decorated.filter((c) => c?.kind === 'wild')).toHaveLength(2);
      decorated.forEach((cell, index) => {
        if (cell?.kind === 'wild') return;
        expect(cell).toEqual(plain[index]);
      });
    }
  });

  it('places the requested number of stones and wilds', () => {
    const board = generateBoard('counts', { cellCount: 45, pairBias: 0.4, stoneCount: 3, wildCount: 2 });
    expect(board.filter(isStone)).toHaveLength(3);
    expect(board.filter((c) => c?.kind === 'wild')).toHaveLength(2);
  });

  it('never puts two stones on one row, and never a row of only stones', () => {
    for (let i = 0; i < 30; i++) {
      const board = generateBoard(`stones-${i}`, { cellCount: 45, pairBias: 0.4, stoneCount: 4 });
      for (const row of rowsOf(board)) {
        expect(row.filter(isStone).length).toBeLessThanOrEqual(1);
        // A row that held nothing but stones could never be cleared away.
        if (row.some(isStone)) expect(row.some(isLive)).toBe(true);
      }
    }
  });

  it('stays deterministic and playable once decorated', () => {
    for (let i = 0; i < 30; i++) {
      const seed = `deco-${i}`;
      const options = { cellCount: 36, pairBias: 0.4, stoneCount: 2, wildCount: 1 };
      expect(generateBoard(seed, options)).toEqual(generateBoard(seed, options));
      expect(hasAnyMove(generateBoard(seed, options))).toBe(true);
    }
  });

  it('asks for no more than the board can hold', () => {
    // One stone per row caps how many a small board takes; the count is an
    // upper bound, and a board short of room simply gets fewer.
    const board = generateBoard('greedy', { cellCount: COLS, pairBias: 0.4, stoneCount: 5 });
    expect(board.filter(isStone).length).toBeLessThanOrEqual(1);
    expect(hasAnyMove(board)).toBe(true);
  });
});
