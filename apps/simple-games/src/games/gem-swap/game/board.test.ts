import { describe, expect, it } from 'vitest';
import {
  ADJACENT_PAIRS,
  applyGravity,
  clearedCells,
  findRuns,
  hasRun,
  hasValidSwap,
  isValidSwap,
  swapCells,
  validSwaps,
} from './board';
import { STUCK_ROWS, boardFrom, rowsOf } from './test-helpers';
import { ADJACENT_PAIR_COUNT, CELL_COUNT, EMPTY, indexAt, isAdjacent } from './types';

/** A quiet five-kind background with no run, to draw test shapes on. */
const QUIET = STUCK_ROWS;

/** QUIET with the given cells overwritten by kind 9 (outside 0..4, so it only matches itself). */
function withNines(cells: readonly [number, number][]): number[] {
  const board = [...boardFrom(QUIET)];
  for (const [r, c] of cells) board[indexAt(r, c)] = 9;
  return board;
}

describe('run detection (§1)', () => {
  it('the quiet background has no run', () => {
    expect(hasRun(boardFrom(QUIET))).toBe(false);
    expect(clearedCells(boardFrom(QUIET))).toEqual([]);
  });

  it('finds a horizontal run of three', () => {
    const board = withNines([
      [2, 3],
      [2, 4],
      [2, 5],
    ]);
    expect(findRuns(board)).toEqual([
      { kind: 9, orientation: 'row', cells: [indexAt(2, 3), indexAt(2, 4), indexAt(2, 5)] },
    ]);
  });

  it('finds a vertical run of three at the board edge', () => {
    const board = withNines([
      [5, 7],
      [6, 7],
      [7, 7],
    ]);
    const runs = findRuns(board);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.orientation).toBe('column');
    expect(runs[0]!.cells).toEqual([indexAt(5, 7), indexAt(6, 7), indexAt(7, 7)]);
  });

  it('a run of four and a run of five are each one run', () => {
    const four = withNines([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    expect(findRuns(four)).toHaveLength(1);
    expect(clearedCells(four)).toHaveLength(4);
    const five = withNines([
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    expect(findRuns(five)).toHaveLength(1);
    expect(clearedCells(five)).toHaveLength(5);
  });

  it('a full row of eight is one run of eight', () => {
    const cells: [number, number][] = [];
    for (let c = 0; c < 8; c++) cells.push([4, c]);
    expect(findRuns(withNines(cells))).toHaveLength(1);
    expect(clearedCells(withNines(cells))).toHaveLength(8);
  });

  it('two in a row and diagonals are not runs', () => {
    expect(
      hasRun(
        withNines([
          [3, 3],
          [3, 4],
        ]),
      ),
    ).toBe(false);
    expect(
      hasRun(
        withNines([
          [1, 1],
          [2, 2],
          [3, 3],
        ]),
      ),
    ).toBe(false);
  });

  it('an L counts its corner once: 3 + 3 − 1 = 5', () => {
    const board = withNines([
      [2, 2],
      [3, 2],
      [4, 2],
      [4, 3],
      [4, 4],
    ]);
    expect(findRuns(board)).toHaveLength(2);
    expect(clearedCells(board)).toHaveLength(5);
  });

  it('a T counts its crossing once: 5 + 3 − 1 = 7', () => {
    const board = withNines([
      [1, 1],
      [1, 2],
      [1, 3],
      [1, 4],
      [1, 5],
      [2, 3],
      [3, 3],
    ]);
    expect(findRuns(board)).toHaveLength(2);
    expect(clearedCells(board)).toHaveLength(7);
  });

  it('a plus counts its centre once: 3 + 3 − 1 = 5', () => {
    const board = withNines([
      [5, 4],
      [6, 3],
      [6, 4],
      [6, 5],
      [7, 4],
    ]);
    expect(clearedCells(board)).toHaveLength(5);
  });

  it('separate runs of different kinds all clear together', () => {
    const board = withNines([
      [0, 0],
      [0, 1],
      [0, 2],
    ]);
    board[indexAt(7, 5)] = 8;
    board[indexAt(6, 5)] = 8;
    board[indexAt(5, 5)] = 8;
    expect(findRuns(board)).toHaveLength(2);
    expect(clearedCells(board)).toHaveLength(6);
  });

  it('EMPTY cells never form a run', () => {
    const board = withNines([]);
    for (let c = 0; c < 8; c++) board[indexAt(0, c)] = EMPTY;
    expect(hasRun(board)).toBe(false);
  });
});

describe('adjacency (§1)', () => {
  it('neighbours are up, down, left and right only', () => {
    expect(isAdjacent(indexAt(3, 3), indexAt(3, 4))).toBe(true);
    expect(isAdjacent(indexAt(3, 3), indexAt(4, 3))).toBe(true);
    expect(isAdjacent(indexAt(3, 3), indexAt(4, 4))).toBe(false);
    expect(isAdjacent(indexAt(3, 3), indexAt(3, 5))).toBe(false);
    expect(isAdjacent(indexAt(3, 3), indexAt(3, 3))).toBe(false);
  });

  it('a row end and the next row start are not neighbours', () => {
    expect(isAdjacent(indexAt(0, 7), indexAt(1, 0))).toBe(false);
  });

  it('rejects indices off the board and non-integers', () => {
    expect(isAdjacent(-1, 0)).toBe(false);
    expect(isAdjacent(63, 64)).toBe(false);
    expect(isAdjacent(0.5, 1.5)).toBe(false);
  });

  it('there are exactly 112 adjacent pairs, all distinct and adjacent', () => {
    expect(ADJACENT_PAIRS).toHaveLength(ADJACENT_PAIR_COUNT);
    expect(ADJACENT_PAIR_COUNT).toBe(112);
    const keys = new Set(ADJACENT_PAIRS.map(([a, b]) => `${a}-${b}`));
    expect(keys.size).toBe(112);
    for (const [a, b] of ADJACENT_PAIRS) {
      expect(a).toBeLessThan(b);
      expect(isAdjacent(a, b)).toBe(true);
    }
  });
});

describe('swap validity (§1)', () => {
  // Row 2 reads 9 9 x 9 with x at column 2: swapping x with its right
  // neighbour lines up 9 9 9 in columns 0-2.
  const board = withNines([
    [2, 0],
    [2, 1],
    [2, 3],
  ]);

  it('the test board starts quiet', () => {
    expect(hasRun(board)).toBe(false);
  });

  it('a swap that makes a horizontal run is valid (either order)', () => {
    expect(isValidSwap(board, indexAt(2, 2), indexAt(2, 3))).toBe(true);
    expect(isValidSwap(board, indexAt(2, 3), indexAt(2, 2))).toBe(true);
  });

  it('a swap that makes a vertical run is valid', () => {
    const vertical = withNines([
      [0, 6],
      [1, 6],
      [2, 5],
    ]);
    expect(hasRun(vertical)).toBe(false);
    expect(isValidSwap(vertical, indexAt(2, 5), indexAt(2, 6))).toBe(true);
  });

  it('the run may pass through either swapped cell', () => {
    // The 9 moving left into column 2 completes 9 9 9 — the run passes
    // through the destination of the second cell.
    expect(hasRun(swapCells(board, indexAt(2, 2), indexAt(2, 3)))).toBe(true);
    const moved = swapCells(board, indexAt(2, 2), indexAt(2, 3));
    expect(clearedCells(moved)).toEqual([indexAt(2, 0), indexAt(2, 1), indexAt(2, 2)]);
  });

  it('a non-adjacent exchange is never valid, even if it would make a run', () => {
    // Moving the 9 at (2,3) two cells away into (2,2)'s place is not a swap.
    const far = withNines([
      [2, 0],
      [2, 1],
      [2, 4],
    ]);
    expect(hasRun(swapCells(far, indexAt(2, 2), indexAt(2, 4)))).toBe(true);
    expect(isValidSwap(far, indexAt(2, 2), indexAt(2, 4))).toBe(false);
    expect(isValidSwap(far, indexAt(1, 2), indexAt(2, 3))).toBe(false);
  });

  it('two gems of the same kind never make a valid swap', () => {
    const same = withNines([
      [4, 4],
      [4, 5],
    ]);
    expect(isValidSwap(same, indexAt(4, 4), indexAt(4, 5))).toBe(false);
  });

  it('an adjacent swap that makes no run is not valid', () => {
    expect(isValidSwap(board, indexAt(5, 5), indexAt(5, 6))).toBe(false);
  });

  it('validSwaps lists exactly the valid pairs, in pair order', () => {
    const listed = validSwaps(board);
    expect(listed.length).toBeGreaterThan(0);
    for (const [a, b] of ADJACENT_PAIRS) {
      const inList = listed.some(([x, y]) => x === a && y === b);
      expect(inList).toBe(isValidSwap(board, a, b));
    }
    // Brute force: a pair is valid iff exchanging makes a run anywhere.
    for (const [a, b] of ADJACENT_PAIRS) {
      const brute = board[a] !== board[b] && hasRun(swapCells(board, a, b));
      expect(isValidSwap(board, a, b)).toBe(brute);
    }
  });

  it('the stuck pattern has no run and no valid swap (brute force over all 112 pairs)', () => {
    const stuck = boardFrom(STUCK_ROWS);
    expect(hasRun(stuck)).toBe(false);
    expect(hasValidSwap(stuck)).toBe(false);
    for (const [a, b] of ADJACENT_PAIRS) expect(hasRun(swapCells(stuck, a, b))).toBe(false);
  });
});

describe('gravity (§1, §4.2)', () => {
  it('surviving gems slide down in order and empties collect at the top', () => {
    const board = boardFrom([
      '01234012',
      '12340123',
      '2.401234',
      '34.12340',
      '4.12.401',
      '0123.012',
      '12340.23',
      '23401234',
    ]);
    const { board: after, drops, emptyPerColumn } = applyGravity(board);
    expect(rowsOf(after)).toEqual([
      '0..3..12',
      '1.24.023',
      '21304134',
      '32410240',
      '44121301',
      '01232412',
      '12340023',
      '23401234',
    ]);
    expect(emptyPerColumn).toEqual([0, 2, 1, 0, 2, 1, 0, 0]);
    // Column 1 had empties at rows 2 and 4: rows 3, 1, 0 fall to 4, 3, 2, keeping their order.
    expect(drops).toContainEqual({ from: indexAt(3, 1), to: indexAt(4, 1) });
    expect(drops).toContainEqual({ from: indexAt(1, 1), to: indexAt(3, 1) });
    expect(drops).toContainEqual({ from: indexAt(0, 1), to: indexAt(2, 1) });
    for (const drop of drops) {
      expect(drop.to % 8).toBe(drop.from % 8);
      expect(drop.to).toBeGreaterThan(drop.from);
    }
  });

  it('a board without empties does not move', () => {
    const { board, drops, emptyPerColumn } = applyGravity(boardFrom(QUIET));
    expect(board).toEqual(boardFrom(QUIET));
    expect(drops).toEqual([]);
    expect(emptyPerColumn).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('a fully emptied column stays empty and reports eight', () => {
    const board = [...boardFrom(QUIET)];
    for (let r = 0; r < 8; r++) board[indexAt(r, 4)] = EMPTY;
    const after = applyGravity(board);
    expect(after.emptyPerColumn[4]).toBe(8);
    expect(after.board.filter((k) => k === EMPTY)).toHaveLength(8);
    expect(after.board).toHaveLength(CELL_COUNT);
  });
});
