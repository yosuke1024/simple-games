/**
 * Gravity and the win check (docs/CONNECT_FOUR_RULES.md §2, §3). Boards are
 * written as pictures so a failure reads as a position, not as forty-two
 * numbers.
 */
import { describe, expect, it } from 'vitest';
import { dropDisc, dropRowOf, isBoardFull, legalColumns, lineThrough } from './engine';
import {
  cellAt,
  countPieces,
  CPU,
  emptyBoard,
  isValidBoard,
  PLAYER,
  ROWS,
  type Board,
  type Piece,
} from './types';

/** Builds a board from 6 rows of '.', 'Y' (you) and 'C' (CPU), top row first. */
function boardOf(...rows: readonly string[]): Board {
  expect(rows).toHaveLength(ROWS);
  const board: Piece[] = [];
  for (const row of rows) {
    expect(row).toHaveLength(7);
    for (const cell of row) board.push(cell === 'Y' ? PLAYER : cell === 'C' ? CPU : 0);
  }
  return board;
}

describe('dropping (§2)', () => {
  it('lands on the bottom of an empty column', () => {
    const board = emptyBoard();
    expect(dropRowOf(board, 3)).toBe(ROWS - 1);
    const dropped = dropDisc(board, PLAYER, 3)!;
    expect(dropped.cell).toBe(cellAt(ROWS - 1, 3));
    expect(countPieces(dropped.board)).toMatchObject({ player: 1, cpu: 0 });
  });

  it('stacks on what is already there', () => {
    let board = emptyBoard();
    board = dropDisc(board, PLAYER, 3)!.board;
    board = dropDisc(board, CPU, 3)!.board;
    const third = dropDisc(board, PLAYER, 3)!;
    expect(third.cell).toBe(cellAt(ROWS - 3, 3));
  });

  it('refuses a full column, and stops offering it', () => {
    const board = boardOf('Y......', 'C......', 'Y......', 'C......', 'Y......', 'C......');
    expect(dropRowOf(board, 0)).toBe(-1);
    expect(dropDisc(board, PLAYER, 0)).toBeNull();
    expect(legalColumns(board)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(isBoardFull(board)).toBe(false);
  });
});

describe('four in a row (§3)', () => {
  it('sees a horizontal line', () => {
    const board = boardOf('.......', '.......', '.......', '.......', '..CCC..', '.YYYY..');
    expect(lineThrough(board, cellAt(5, 1))).toEqual([
      cellAt(5, 1),
      cellAt(5, 2),
      cellAt(5, 3),
      cellAt(5, 4),
    ]);
  });

  it('sees a vertical line', () => {
    const board = boardOf('.......', '.......', '..C....', '..C....', '..C....', '..C.YYY');
    expect(lineThrough(board, cellAt(3, 2))).toHaveLength(4);
    // Three is not four: the player's row stays unfinished.
    expect(lineThrough(board, cellAt(5, 4))).toBeNull();
  });

  it('sees both diagonals', () => {
    const rising = boardOf('.......', '.......', '...Y...', '..YC...', '.YCC...', 'YCCY...');
    expect(lineThrough(rising, cellAt(2, 3))).toHaveLength(4);

    const falling = boardOf('.......', '.......', 'Y......', 'CY.....', 'CCY....', 'CCCY...');
    expect(lineThrough(falling, cellAt(5, 3))).toHaveLength(4);
  });

  it('returns the whole run when five connect', () => {
    const board = boardOf('.......', '.......', '.......', '.......', '.......', '.YYYYY.');
    expect(lineThrough(board, cellAt(5, 3))).toHaveLength(5);
  });

  it('reports nothing for an empty cell', () => {
    expect(lineThrough(emptyBoard(), 0)).toBeNull();
  });
});

describe('boards that could not have come from play (§8)', () => {
  it('rejects a floating disc', () => {
    const floating = boardOf('.......', '.......', '.......', '.Y.....', '.......', '.......');
    expect(isValidBoard(floating, PLAYER)).toBe(false);
  });

  it('rejects counts the opener cannot reach', () => {
    // Whoever dropped first is level or one ahead — never two.
    const impossible = boardOf('.......', '.......', '.......', '.......', '.......', 'YY.....');
    expect(isValidBoard(impossible, PLAYER)).toBe(false);
    // ...and the same board read as "the CPU opened" is impossible twice
    // over: the player is two ahead of a side that should be level or ahead.
    expect(isValidBoard(impossible, CPU)).toBe(false);
  });

  it('accepts a real position, for the side that actually opened (§1)', () => {
    const real = boardOf('.......', '.......', '.......', '.......', '...C...', '..YYC.Y');
    expect(isValidBoard(real, PLAYER)).toBe(true);
    // Three player discs to two CPU ones can only have come from the player
    // opening; claiming the CPU did makes the same board unreachable.
    expect(isValidBoard(real, CPU)).toBe(false);
  });

  it('accepts a board the CPU opened', () => {
    const cpuOpened = boardOf('.......', '.......', '.......', '.......', '...Y...', '..CCY.C');
    expect(isValidBoard(cpuOpened, CPU)).toBe(true);
  });
});
