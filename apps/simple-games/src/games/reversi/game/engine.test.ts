/**
 * The capture rule, exercised (docs/REVERSI_RULES.md §2): what flips, what is
 * legal, and when a side is out of moves. Boards are written as pictures so a
 * failure reads as a position, not as sixty-four numbers.
 */
import { describe, expect, it } from 'vitest';
import { flipsFor, hasAnyMove, isLegalMove, legalMovesOf, placeDisc } from './engine';
import {
  BLACK,
  BOARD_SIZE,
  countDiscs,
  initialBoard,
  WHITE,
  type Board,
  type Piece,
} from './types';

/** Builds a board from 8 rows of '.', 'B', 'W'. */
function boardOf(...rows: readonly string[]): Board {
  expect(rows).toHaveLength(BOARD_SIZE);
  const board: Piece[] = [];
  for (const row of rows) {
    expect(row).toHaveLength(BOARD_SIZE);
    for (const cell of row) {
      board.push(cell === 'B' ? BLACK : cell === 'W' ? WHITE : 0);
    }
  }
  return board;
}

const at = (row: number, col: number) => row * BOARD_SIZE + col;

describe('the opening position', () => {
  it('is two discs each, crossed in the centre (§1)', () => {
    const board = initialBoard();
    expect(countDiscs(board)).toEqual({ black: 2, white: 2, empty: 60 });
    expect(board[at(3, 3)]).toBe(WHITE);
    expect(board[at(4, 4)]).toBe(WHITE);
    expect(board[at(3, 4)]).toBe(BLACK);
    expect(board[at(4, 3)]).toBe(BLACK);
  });

  it('gives black its four classic first moves', () => {
    expect(legalMovesOf(initialBoard(), BLACK)).toEqual([at(2, 3), at(3, 2), at(4, 5), at(5, 4)]);
  });
});

describe('captures (§2)', () => {
  it('flips only a run closed by an own disc', () => {
    const board = boardOf(
      '........',
      '........',
      '........',
      '...WW...',
      '...WB...',
      '........',
      '........',
      '........',
    );
    // Rightwards from (3,2) the whites run into an empty cell: no capture,
    // so no move (§2).
    expect(flipsFor(board, BLACK, at(3, 2))).toEqual([]);
    // From (2,2) the diagonal white at (3,3) is closed by the black at (4,4).
    expect(flipsFor(board, BLACK, at(2, 2))).toEqual([at(3, 3)]);
  });

  it('flips in every closed direction at once', () => {
    const board = boardOf(
      '........',
      '........',
      '.....B..',
      '.....W..',
      '...BW...',
      '....W...',
      '...B....',
      '........',
    );
    const flips = flipsFor(board, BLACK, at(4, 5));
    // One placement closing three runs — left, up, and down-left — takes
    // every white it traps, and only those.
    expect(new Set(flips)).toEqual(new Set([at(4, 4), at(3, 5), at(5, 4)]));
  });

  it('does not flip past an empty cell or off the edge', () => {
    const board = boardOf(
      'WWWWWWW.',
      '........',
      '........',
      '...WW...',
      '...WB...',
      '........',
      '........',
      '........',
    );
    // The top row runs to the edge with no closing disc: placing at (0,7)
    // captures along no direction, so it is not a move at all.
    expect(flipsFor(board, BLACK, at(0, 7))).toEqual([]);
  });

  it('rejects occupied cells', () => {
    expect(isLegalMove(initialBoard(), BLACK, at(3, 3))).toBe(false);
    expect(placeDisc(initialBoard(), BLACK, at(3, 3))).toBeNull();
  });

  it('placeDisc turns exactly the discs flipsFor names', () => {
    const board = initialBoard();
    const cell = at(2, 3);
    const flips = flipsFor(board, BLACK, cell);
    const placed = placeDisc(board, BLACK, cell)!;
    expect(placed.flipped).toEqual(flips);
    expect(placed.board[cell]).toBe(BLACK);
    for (const index of flips) expect(placed.board[index]).toBe(BLACK);
    // Three blacks placed or turned, and white is down to one (§2).
    expect(countDiscs(placed.board)).toEqual({ black: 4, white: 1, empty: 59 });
  });
});

describe('running out of moves (§3, §4)', () => {
  it('sees a stuck side while the other still has a move (§4)', () => {
    const board = boardOf(
      'BW......',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    );
    // Black closes the white against its own corner disc; white would need a
    // cell beyond the corner, which does not exist.
    expect(legalMovesOf(board, BLACK)).toEqual([at(0, 2)]);
    expect(hasAnyMove(board, WHITE)).toBe(false);
  });

  it('a full board has no moves for either side', () => {
    const full = boardOf(
      'BBBBBBBB',
      'BBBBBBBB',
      'BBBBBBBB',
      'BBBBWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
    );
    expect(hasAnyMove(full, BLACK)).toBe(false);
    expect(hasAnyMove(full, WHITE)).toBe(false);
  });
});
