/**
 * The rules, pinned (docs/GOMOKU_RULES.md §1–§3). Freestyle: five in a row
 * wins, and so does six — the overline is a win here, not a foul, which is
 * the one place a reader coming from renju will expect something else (§11).
 */
import { describe, expect, it } from 'vitest';
import { findWinner, isBoardFull, legalMoves, lineThrough, placeStone } from './engine';
import { decodeBoard, encodeBoard } from './serialize';
import {
  BLACK,
  CELL_COUNT,
  CENTRE,
  EMPTY,
  SIZE,
  WHITE,
  cellAt,
  countStones,
  emptyBoard,
  isValidBoard,
  sideToMove,
  type Board,
  type Piece,
} from './types';

/** Puts `player` on each of `cells`, in order. */
function withStones(cells: readonly (readonly [number, number])[], player: Piece): Board {
  const board = emptyBoard().slice() as Piece[];
  for (const [row, col] of cells) board[cellAt(row, col)] = player;
  return board;
}

describe('the empty board', () => {
  it('is 225 intersections, all of them legal', () => {
    expect(emptyBoard()).toHaveLength(CELL_COUNT);
    expect(legalMoves(emptyBoard())).toHaveLength(CELL_COUNT);
    expect(isBoardFull(emptyBoard())).toBe(false);
  });

  it('puts the centre where a 15 by 15 board has one', () => {
    expect(CENTRE).toBe(cellAt(7, 7));
  });

  it('is black to move — black always opens', () => {
    expect(sideToMove(emptyBoard())).toBe(BLACK);
  });
});

describe('placing a stone', () => {
  it('fills the intersection and leaves the rest alone', () => {
    const board = placeStone(emptyBoard(), BLACK, cellAt(7, 7))!;
    expect(board[cellAt(7, 7)]).toBe(BLACK);
    expect(countStones(board)).toEqual({ black: 1, white: 0, empty: CELL_COUNT - 1 });
  });

  it('refuses an intersection that already has a stone', () => {
    const board = placeStone(emptyBoard(), BLACK, cellAt(7, 7))!;
    expect(placeStone(board, WHITE, cellAt(7, 7))).toBeNull();
  });

  it('refuses an index off the board', () => {
    expect(placeStone(emptyBoard(), BLACK, -1)).toBeNull();
    expect(placeStone(emptyBoard(), BLACK, CELL_COUNT)).toBeNull();
  });

  it('hands the turn to the other colour', () => {
    const board = placeStone(emptyBoard(), BLACK, cellAt(7, 7))!;
    expect(sideToMove(board)).toBe(WHITE);
  });
});

describe('five in a row', () => {
  it('wins across a row', () => {
    const board = withStones(
      [
        [7, 3],
        [7, 4],
        [7, 5],
        [7, 6],
        [7, 7],
      ],
      BLACK,
    );
    expect(lineThrough(board, cellAt(7, 5))).toHaveLength(5);
  });

  it('wins down a column', () => {
    const board = withStones(
      [
        [2, 9],
        [3, 9],
        [4, 9],
        [5, 9],
        [6, 9],
      ],
      WHITE,
    );
    expect(lineThrough(board, cellAt(4, 9))).toHaveLength(5);
  });

  it('wins on the down-right diagonal', () => {
    const board = withStones(
      [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
        [5, 5],
      ],
      BLACK,
    );
    expect(lineThrough(board, cellAt(3, 3))).toHaveLength(5);
  });

  it('wins on the down-left diagonal', () => {
    const board = withStones(
      [
        [1, 9],
        [2, 8],
        [3, 7],
        [4, 6],
        [5, 5],
      ],
      WHITE,
    );
    expect(lineThrough(board, cellAt(3, 7))).toHaveLength(5);
  });

  it('does not win with four', () => {
    const board = withStones(
      [
        [7, 3],
        [7, 4],
        [7, 5],
        [7, 6],
      ],
      BLACK,
    );
    expect(lineThrough(board, cellAt(7, 5))).toBeNull();
  });

  it('is not fooled by a run that wraps the edge', () => {
    // Columns 13, 14 then 0, 1, 2 of the next row are contiguous in the flat
    // array but not on the board.
    const board = withStones(
      [
        [3, 13],
        [3, 14],
        [4, 0],
        [4, 1],
        [4, 2],
      ],
      BLACK,
    );
    expect(lineThrough(board, cellAt(3, 14))).toBeNull();
    expect(lineThrough(board, cellAt(4, 0))).toBeNull();
  });

  it('counts an overline as a win, and returns the whole run (§11)', () => {
    const board = withStones(
      [
        [7, 2],
        [7, 3],
        [7, 4],
        [7, 5],
        [7, 6],
        [7, 7],
      ],
      BLACK,
    );
    expect(lineThrough(board, cellAt(7, 4))).toHaveLength(6);
  });

  it('finds the winner on a board it did not watch being played', () => {
    const board = withStones(
      [
        [7, 3],
        [7, 4],
        [7, 5],
        [7, 6],
        [7, 7],
      ],
      WHITE,
    );
    const found = findWinner(board)!;
    expect(found.player).toBe(WHITE);
    expect(found.line).toHaveLength(5);
  });

  it('finds no winner on an empty board', () => {
    expect(findWinner(emptyBoard())).toBeNull();
  });
});

describe('a full board', () => {
  it('is a draw when nobody made five', () => {
    // Rows of BBWW BBWW … never make five of a colour anywhere.
    const cells: Piece[] = [];
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const band = Math.floor((col + row * 2) / 2) % 2;
        cells.push(band === 0 ? BLACK : WHITE);
      }
    }
    expect(isBoardFull(cells)).toBe(true);
    expect(legalMoves(cells)).toHaveLength(0);
  });
});

describe('board validation fails closed', () => {
  const played = (() => {
    let board = emptyBoard();
    board = placeStone(board, BLACK, cellAt(7, 7))!;
    board = placeStone(board, WHITE, cellAt(7, 8))!;
    board = placeStone(board, BLACK, cellAt(8, 7))!;
    return board;
  })();

  it('accepts what it wrote', () => {
    expect(decodeBoard(encodeBoard(played))).toEqual(played);
  });

  it('rejects the wrong length', () => {
    expect(decodeBoard(encodeBoard(played).slice(1))).toBeNull();
  });

  it('rejects an unknown stone', () => {
    expect(decodeBoard(`3${encodeBoard(played).slice(1)}`)).toBeNull();
  });

  it('rejects white ahead of black — black opens', () => {
    const wrong = emptyBoard().slice() as Piece[];
    wrong[cellAt(0, 0)] = WHITE;
    expect(isValidBoard(wrong)).toBe(false);
  });

  it('rejects black two ahead — the turn never skips', () => {
    const wrong = emptyBoard().slice() as Piece[];
    wrong[cellAt(0, 0)] = BLACK;
    wrong[cellAt(0, 1)] = BLACK;
    expect(isValidBoard(wrong)).toBe(false);
  });

  it('accepts an even split and a black lead of one', () => {
    expect(isValidBoard(emptyBoard())).toBe(true);
    expect(isValidBoard(played)).toBe(true);
  });

  it('rejects a stone value that is neither colour nor empty', () => {
    const wrong = emptyBoard().slice() as Piece[];
    wrong[0] = 7 as Piece;
    expect(isValidBoard(wrong)).toBe(false);
  });

  it('leaves an untouched board reading as empty', () => {
    expect(countStones(emptyBoard())).toEqual({ black: 0, white: 0, empty: CELL_COUNT });
    expect(emptyBoard().every((piece) => piece === EMPTY)).toBe(true);
  });
});
