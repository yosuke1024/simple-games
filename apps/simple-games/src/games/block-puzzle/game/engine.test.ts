/**
 * Board rules (docs/BLOCK_PUZZLE_RULES.md §3, §4, §5, §2).
 *
 * The two that need proving rather than reading are the simultaneous clear —
 * a placement that finishes a row and a column at once takes both and counts
 * two, once (§4) — and the ending, which has to be false only when the board
 * really has no room for anything left in the tray (§2).
 */
import { describe, expect, it } from 'vitest';
import {
  canPlace,
  clearedCells,
  clearLines,
  hasAnyMove,
  place,
  pieceCells,
  scoreFor,
} from './engine';
import { PIECES, pieceById } from './pieces';
import { BOARD_SIZE, emptyBoard, indexAt, type Board } from './types';

/** A board from a picture: '#' filled, anything else empty. */
const boardFrom = (rows: readonly string[]): Board =>
  rows
    .join('')
    .split('')
    .map((character) => character === '#');

const piece = (id: number) => pieceById(id)!;

/** 1×1, 1×5, 5×1, 3×3 — the catalogue entries the tests below lean on. */
const SINGLE = piece(0);
const ROW_OF_FIVE = piece(7);
const COLUMN_OF_FIVE = piece(8);
const BLOCK_3X3 = piece(10);

describe('placement legality (§3)', () => {
  it('accepts a piece that fits inside the board', () => {
    expect(canPlace(emptyBoard(), BLOCK_3X3, 0, 0)).toBe(true);
    expect(canPlace(emptyBoard(), BLOCK_3X3, 5, 5)).toBe(true);
  });

  it('refuses a piece whose cells would leave the board', () => {
    expect(canPlace(emptyBoard(), BLOCK_3X3, 6, 0)).toBe(false);
    expect(canPlace(emptyBoard(), BLOCK_3X3, 0, 6)).toBe(false);
    expect(canPlace(emptyBoard(), SINGLE, -1, 0)).toBe(false);
    expect(canPlace(emptyBoard(), SINGLE, 0, BOARD_SIZE)).toBe(false);
    expect(canPlace(emptyBoard(), ROW_OF_FIVE, 0, 4)).toBe(false);
    expect(canPlace(emptyBoard(), COLUMN_OF_FIVE, 4, 0)).toBe(false);
  });

  it('refuses a piece that would cover a filled cell', () => {
    const board = [...emptyBoard()];
    board[indexAt(1, 1)] = true;
    expect(canPlace(board, BLOCK_3X3, 0, 0)).toBe(false);
    // One cell over, and the same shape fits.
    expect(canPlace(board, BLOCK_3X3, 2, 2)).toBe(true);
  });

  it('fills exactly the cells of the piece and reports how many', () => {
    const result = place(emptyBoard(), BLOCK_3X3, 1, 2);
    expect(result.cells).toBe(9);
    expect(result.board.filter(Boolean)).toHaveLength(9);
    for (const index of pieceCells(BLOCK_3X3, 1, 2)) expect(result.board[index]).toBe(true);
  });
});

describe('clearing lines (§4)', () => {
  it('takes nothing when no line is complete', () => {
    const board = place(emptyBoard(), ROW_OF_FIVE, 0, 0).board;
    const result = clearLines(board);
    expect(result.lines).toBe(0);
    expect(result.board).toBe(board);
  });

  it('takes a row and a column completed together, counting two, once', () => {
    // Row 0 is full but for (0,0); column 0 is full but for (0,0). A single
    // square there finishes both at the same instant.
    const rows = [
      '.#######',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
      '#.......',
    ];
    const filled = place(boardFrom(rows), SINGLE, 0, 0).board;
    const result = clearLines(filled);

    expect(result.lines).toBe(2);
    // Both lines are gone, and nothing else was touched: the board had only
    // those two lines on it, so it comes back empty.
    expect(result.board.filter(Boolean)).toHaveLength(0);
  });

  it('takes several rows at once', () => {
    const rows = [
      '########',
      '########',
      '##......',
      '........',
      '........',
      '........',
      '........',
      '........',
    ];
    const result = clearLines(boardFrom(rows));
    expect(result.lines).toBe(2);
    expect(result.board.filter(Boolean)).toHaveLength(2);
    expect(result.board[indexAt(2, 0)]).toBe(true);
    expect(result.board[indexAt(2, 1)]).toBe(true);
  });

  it('reports the cells a clear emptied, the placed ones included (§12)', () => {
    const rows = [
      '.#######',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ];
    const before = boardFrom(rows);
    const filled = place(before, SINGLE, 0, 0).board;
    const after = clearLines(filled).board;
    const cleared = clearedCells(before, after, pieceCells(SINGLE, 0, 0));
    // The whole row, including the square that had just been put down: it
    // was there for an instant, and the fade has to cover it too.
    expect([...cleared]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('scoring (§5)', () => {
  it('gives a point per square put down', () => {
    expect(scoreFor(1, 0)).toBe(1);
    expect(scoreFor(9, 0)).toBe(9);
  });

  it('adds 10, 30, 60, 100 for one to four lines', () => {
    expect(scoreFor(0, 1)).toBe(10);
    expect(scoreFor(0, 2)).toBe(30);
    expect(scoreFor(0, 3)).toBe(60);
    expect(scoreFor(0, 4)).toBe(100);
  });

  it('adds the two together', () => {
    expect(scoreFor(5, 2)).toBe(35);
  });
});

describe('running out of room (§2)', () => {
  it('is true while anything at all fits', () => {
    expect(hasAnyMove(emptyBoard(), [...PIECES])).toBe(true);
  });

  /**
   * Every row and every column keeps one gap, so nothing has cleared, and no
   * two gaps touch — which leaves exactly one shape in the catalogue that
   * still fits: the single square.
   */
  const scattered = boardFrom([
    '.#######',
    '###.####',
    '######.#',
    '#.######',
    '####.###',
    '#######.',
    '##.#####',
    '#####.##',
  ]);

  it('is true only for the one shape that still fits', () => {
    expect(hasAnyMove(scattered, [SINGLE])).toBe(true);
    for (const shape of PIECES.slice(1)) {
      expect(hasAnyMove(scattered, [shape]), `piece ${shape.id}`).toBe(false);
    }
  });

  it('is false when no remaining piece fits anywhere', () => {
    expect(hasAnyMove(scattered, [ROW_OF_FIVE, COLUMN_OF_FIVE, BLOCK_3X3])).toBe(false);
    // And an empty tray has nothing to fit, which is the same answer.
    expect(hasAnyMove(scattered, [])).toBe(false);
  });
});
