/**
 * Board rules of docs/SHAPE_REGIONS_RULES.md §3, §4 and §5: how a region
 * grows under a stroke, what a tap takes away, what is broken, and the win.
 *
 * The board is a 3×3 with three horizontal lines of three, clued at the left
 * end of each — the smallest board where every rule has something to say.
 */
import { describe, expect, it } from 'vitest';
import {
  addCells,
  findViolations,
  initialAssignment,
  isSolved,
  reachableFromClue,
  regionCells,
  removeCell,
} from './engine';
import { UNASSIGNED, type Layout } from './types';

const LINES: Layout = {
  width: 3,
  height: 3,
  clues: [
    { index: 0, size: 3, shape: 'line' },
    { index: 3, size: 3, shape: 'line' },
    { index: 6, size: 3, shape: 'line' },
  ],
};

const A = 0;
const B = 1;
const C = 2;

describe('the first board (§4)', () => {
  it('assigns every clue to its own region and nothing else', () => {
    expect(initialAssignment(LINES)).toEqual([A, -1, -1, B, -1, -1, C, -1, -1]);
    expect(UNASSIGNED).toBe(-1);
  });
});

describe('a stroke grows a region (§4)', () => {
  it('adds cells that touch the region as it grows', () => {
    const grown = addCells(initialAssignment(LINES), LINES, A, [1, 2]);
    expect(grown).toEqual([A, A, A, B, -1, -1, C, -1, -1]);
  });

  it('adds nothing that does not touch the region, and says so', () => {
    // Cell 7 touches 4, 6 and 8 — none of them A's.
    expect(addCells(initialAssignment(LINES), LINES, A, [7])).toBeNull();
    // Cell 2 only joins once cell 1 has; offered the other way round it does not.
    expect(addCells(initialAssignment(LINES), LINES, A, [2, 1])).toEqual([
      A,
      A,
      -1,
      B,
      -1,
      -1,
      C,
      -1,
      -1,
    ]);
  });

  it('never takes a clue cell or a cell of another region', () => {
    let board = initialAssignment(LINES);
    board = addCells(board, LINES, B, [4])!;
    // A's stroke crosses B's clue and B's cell: both are skipped, and the
    // cell beyond them does not touch A, so it is skipped too.
    expect(addCells(board, LINES, A, [3, 4, 5])).toBeNull();
    // Crossing its own cell is fine, and the stroke carries on from there.
    expect(addCells(board, LINES, A, [1, 4, 2])).toEqual([A, A, A, B, B, -1, C, -1, -1]);
  });

  it('refuses an unknown region and an index off the board', () => {
    expect(addCells(initialAssignment(LINES), LINES, 3, [1])).toBeNull();
    expect(addCells(initialAssignment(LINES), LINES, A, [9, -1])).toBeNull();
  });
});

describe('a tap removes a cell and what it cut off (§4)', () => {
  it('removes the cell', () => {
    const board = addCells(initialAssignment(LINES), LINES, A, [1, 2])!;
    expect(removeCell(board, LINES, 2)).toEqual([A, A, -1, B, -1, -1, C, -1, -1]);
  });

  it('removes with it every cell the clue can no longer reach', () => {
    const board = addCells(initialAssignment(LINES), LINES, A, [1, 2])!;
    expect(removeCell(board, LINES, 1)).toEqual([A, -1, -1, B, -1, -1, C, -1, -1]);
  });

  it('keeps cells that stay connected another way', () => {
    // A ring around cell 4: remove one link and the rest still reach the clue.
    const ring: Layout = { width: 3, height: 3, clues: [{ index: 0, size: null, shape: null }] };
    const board = addCells(initialAssignment(ring), ring, 0, [1, 2, 5, 8, 7, 6, 3])!;
    expect(removeCell(board, ring, 5)).toEqual([0, 0, 0, 0, -1, -1, 0, 0, 0]);
  });

  it('never removes a clue cell, and does nothing on an empty cell', () => {
    const board = addCells(initialAssignment(LINES), LINES, A, [1])!;
    expect(removeCell(board, LINES, 0)).toBeNull();
    expect(removeCell(board, LINES, 8)).toBeNull();
    expect(removeCell(board, LINES, 99)).toBeNull();
  });

  it('reads reachability from the clue only', () => {
    const board = [A, A, A, B, -1, -1, C, -1, A];
    expect([...reachableFromClue(board, LINES, A)].sort()).toEqual([0, 1, 2]);
    expect(regionCells(board, A)).toEqual([0, 1, 2, 8]);
  });
});

describe('violations (§5)', () => {
  it('flags a region bigger than its number', () => {
    const board = addCells(initialAssignment(LINES), LINES, A, [1, 2, 5])!;
    const violations = findViolations(LINES, board);
    expect(violations.regions).toEqual([true, false, false]);
    expect(violations.cells).toEqual([true, true, true, false, false, true, false, false, false]);
    expect(violations.any).toBe(true);
  });

  it('flags a complete region whose shape is not the symbol', () => {
    // Three cells, as the number says, but bent — not a line.
    const bent: Layout = {
      width: 3,
      height: 3,
      clues: [
        { index: 0, size: 3, shape: 'line' },
        { index: 8, size: null, shape: null },
      ],
    };
    const board = addCells(initialAssignment(bent), bent, 0, [1, 4])!;
    expect(findViolations(bent, board).regions[0]).toBe(true);
  });

  it('says nothing while a region is still short of its number', () => {
    const board = addCells(initialAssignment(LINES), LINES, A, [1])!;
    expect(findViolations(LINES, board).any).toBe(false);
  });

  it('flags a symbol-only region only once it cannot grow further', () => {
    const wide: Layout = {
      width: 4,
      height: 2,
      clues: [
        { index: 0, size: null, shape: 'line' },
        { index: 7, size: null, shape: null },
      ],
    };
    // Five cells, bent: not a line, but one more cell could still be added.
    const five = addCells(initialAssignment(wide), wide, 0, [1, 2, 3, 4])!;
    expect(findViolations(wide, five).any).toBe(false);
    // Six cells: the ceiling. Bent at six is bent for good.
    const six = addCells(five, wide, 0, [5])!;
    expect(findViolations(wide, six).regions[0]).toBe(true);
    // Seven cells breaks the size rule whatever the symbol says.
    const seven = addCells(six, wide, 0, [6])!;
    expect(findViolations(wide, seven).regions[0]).toBe(true);
  });
});

describe('the win (§3)', () => {
  const solved = [A, A, A, B, B, B, C, C, C];

  it('is every cell assigned and every rule kept', () => {
    expect(isSolved(LINES, solved)).toBe(true);
  });

  it('is not a board with a cell left over', () => {
    expect(isSolved(LINES, [A, A, A, B, B, B, C, C, -1])).toBe(false);
  });

  it('is not a board where a region breaks its clue', () => {
    // Right count for A and B but the wrong shapes; C is the right shape.
    expect(isSolved(LINES, [A, A, B, A, B, B, C, C, C])).toBe(false);
    // A clue cell taken by another region.
    expect(isSolved(LINES, [A, A, A, A, B, B, C, C, C])).toBe(false);
  });

  it('guards the lengths, so an empty board is never a win', () => {
    expect(isSolved(LINES, [])).toBe(false);
    expect(isSolved(LINES, solved.slice(0, 8))).toBe(false);
    expect(isSolved(LINES, [...solved, A])).toBe(false);
  });

  it('is not a region assigned around a gap the clue cannot reach', () => {
    const disconnected: Layout = {
      width: 3,
      height: 1,
      clues: [
        { index: 0, size: 2, shape: 'line' },
        { index: 1, size: null, shape: null },
      ],
    };
    // A holds cells 0 and 2 across B's clue: right count, unreachable.
    expect(isSolved(disconnected, [0, 1, 0])).toBe(false);
  });
});
