/**
 * The board rules of docs/BOX_REGIONS_RULES.md §2–§5 on a hand-drawn 3×3:
 * what a rectangle is and what kind it is, what one stroke and one tap do,
 * what the violation display says, and the win.
 *
 * The board: a 2×2 square clued at 0, a 1×2 tall box clued at 5, and a 3×1
 * wide box clued at 7.
 *
 *   a a b
 *   a a b
 *   c c c
 */
import { describe, expect, it } from 'vitest';
import {
  drawRect,
  findViolations,
  initialAssignment,
  isSolved,
  previewDraw,
  regionSatisfiesClue,
  tapCell,
} from './engine';
import { kindOf, rectOfCells, rectSatisfiesClue, spanRect } from './rects';
import { UNASSIGNED, isValidClueList, type Layout } from './types';

const _ = UNASSIGNED;

const LAYOUT: Layout = {
  width: 3,
  height: 3,
  clues: [
    { index: 0, size: 4, kind: 'square' },
    { index: 5, size: 2, kind: 'tall' },
    { index: 7, size: 3, kind: 'wide' },
  ],
};
const SOLUTION = [0, 0, 1, 0, 0, 1, 2, 2, 2];

describe('rectangles and their kinds (§1, §2)', () => {
  it('reads square, tall and wide off the sides, and a 1×1 is a square', () => {
    expect(kindOf(1, 1)).toBe('square');
    expect(kindOf(2, 2)).toBe('square');
    expect(kindOf(1, 2)).toBe('tall');
    expect(kindOf(3, 2)).toBe('wide');
  });

  it('knows a filled rectangle from a ragged or holed set of cells', () => {
    expect(rectOfCells([0, 1, 3, 4], 3)).toEqual({ top: 0, left: 0, width: 2, height: 2 });
    expect(rectOfCells([4], 3)).toEqual({ top: 1, left: 1, width: 1, height: 1 });
    expect(rectOfCells([0, 1, 3], 3)).toBeNull();
    expect(rectOfCells([0, 2], 3)).toBeNull();
    expect(rectOfCells([], 3)).toBeNull();
  });

  it('spans a rectangle from either pair of opposite corners', () => {
    expect(spanRect(0, 4, 3)).toEqual({ top: 0, left: 0, width: 2, height: 2 });
    expect(spanRect(4, 0, 3)).toEqual(spanRect(0, 4, 3));
    expect(spanRect(3, 1, 3)).toEqual({ top: 0, left: 0, width: 2, height: 2 });
  });

  it('checks a clue: area, kind, the 1–12 bounds, and free as no kind at all', () => {
    const twoByTwo = { top: 0, left: 0, width: 2, height: 2 };
    expect(rectSatisfiesClue(twoByTwo, { index: 0, size: 4, kind: 'square' })).toBe(true);
    expect(rectSatisfiesClue(twoByTwo, { index: 0, size: 3, kind: 'square' })).toBe(false);
    expect(rectSatisfiesClue(twoByTwo, { index: 0, size: null, kind: 'tall' })).toBe(false);
    expect(rectSatisfiesClue(twoByTwo, { index: 0, size: null, kind: 'free' })).toBe(true);
    const thirteen = { top: 0, left: 0, width: 13, height: 1 };
    expect(rectSatisfiesClue(thirteen, { index: 0, size: null, kind: 'free' })).toBe(false);
  });

  it('accepts a clue that says nothing, and refuses sizes and kinds it does not know', () => {
    expect(isValidClueList([{ index: 0, size: null, kind: 'free' }], 3, 3)).toBe(true);
    expect(isValidClueList([{ index: 0, size: 13, kind: 'free' }], 3, 3)).toBe(false);
    expect(isValidClueList([{ index: 0, size: 0, kind: 'free' }], 3, 3)).toBe(false);
    expect(isValidClueList([{ index: 0, size: 2, kind: 'round' as never }], 3, 3)).toBe(false);
    expect(
      isValidClueList(
        [
          { index: 1, size: 2, kind: 'free' },
          { index: 1, size: 2, kind: 'free' },
        ],
        3,
        3,
      ),
    ).toBe(false);
  });
});

describe('drawing a box (§4)', () => {
  it('starts with every cell unassigned, clue cells included', () => {
    expect(initialAssignment(LAYOUT)).toEqual(new Array(9).fill(_));
  });

  it('makes the rectangle between two corners the box of the one clue inside', () => {
    const board = drawRect(initialAssignment(LAYOUT), LAYOUT, 4, 0);
    expect(board).toEqual([0, 0, _, 0, 0, _, _, _, _]);
  });

  it('draws nothing when the rectangle holds no clue, or two', () => {
    const empty = initialAssignment(LAYOUT);
    expect(drawRect(empty, LAYOUT, 1, 4)).toBeNull();
    expect(drawRect(empty, LAYOUT, 0, 5)).toBeNull();
    expect(previewDraw(LAYOUT, 1, 4)).toEqual({ cells: [1, 4], region: null });
    expect(previewDraw(LAYOUT, 0, 5).region).toBeNull();
    expect(previewDraw(LAYOUT, 6, 8)).toEqual({ cells: [6, 7, 8], region: 2 });
  });

  it('removes every box it overlaps, whole, and the clue’s own old box', () => {
    // a as the 2×2, c as the bottom row.
    let board = drawRect(initialAssignment(LAYOUT), LAYOUT, 0, 4)!;
    board = drawRect(board, LAYOUT, 6, 8)!;
    // A tall b down the right column takes one cell from c: c goes whole.
    const next = drawRect(board, LAYOUT, 2, 8)!;
    expect(next).toEqual([0, 0, 1, 0, 0, 1, _, _, 1]);
    // Redrawing a smaller: the old a goes, the new one stays.
    expect(drawRect(board, LAYOUT, 0, 1)).toEqual([0, 0, _, _, _, _, 2, 2, 2]);
  });

  it('returns null when the same box is drawn again', () => {
    const board = drawRect(initialAssignment(LAYOUT), LAYOUT, 0, 4)!;
    expect(drawRect(board, LAYOUT, 4, 0)).toBeNull();
  });
});

describe('tapping (§4)', () => {
  it('removes the whole box a cell belongs to', () => {
    const board = drawRect(initialAssignment(LAYOUT), LAYOUT, 0, 4)!;
    expect(tapCell(board, LAYOUT, 4)).toEqual(initialAssignment(LAYOUT));
  });

  it('makes an undrawn clue a 1×1, and does nothing on a bare cell', () => {
    const empty = initialAssignment(LAYOUT);
    expect(tapCell(empty, LAYOUT, 5)).toEqual([_, _, _, _, _, 1, _, _, _]);
    expect(tapCell(empty, LAYOUT, 4)).toBeNull();
  });
});

describe('violations (§5)', () => {
  it('says nothing about a legal box, even one that is not the answer', () => {
    // A clue that says nothing: any rectangle around it is legal, answer or not.
    const loose: Layout = { ...LAYOUT, clues: [{ index: 0, size: null, kind: 'free' }] };
    const board = drawRect(initialAssignment(loose), loose, 0, 1)!;
    expect(findViolations(loose, board).any).toBe(false);
  });

  it('marks a box with the wrong count, short or over, and the wrong kind', () => {
    const short = drawRect(initialAssignment(LAYOUT), LAYOUT, 0, 1)!;
    const shortSeen = findViolations(LAYOUT, short);
    expect(shortSeen.regions).toEqual([true, false, false]);
    expect(shortSeen.cells).toEqual([true, true, false, false, false, false, false, false, false]);

    // b drawn as a 1×1: square, not tall — and one cell, not two.
    const unit = tapCell(initialAssignment(LAYOUT), LAYOUT, 5)!;
    expect(findViolations(LAYOUT, unit).regions).toEqual([false, true, false]);

    // Kind alone: a wide 2×1 for a tall clue with no number.
    const kindOnly: Layout = { ...LAYOUT, clues: [{ index: 5, size: null, kind: 'tall' }] };
    const wide = drawRect(initialAssignment(kindOnly), kindOnly, 4, 5)!;
    expect(findViolations(kindOnly, wide).any).toBe(true);
  });

  it('marks a box over twelve cells even when its clue names no number', () => {
    const wide: Layout = { width: 7, height: 2, clues: [{ index: 0, size: null, kind: 'free' }] };
    const board = drawRect(initialAssignment(wide), wide, 0, 13)!;
    expect(board.every((region) => region === 0)).toBe(true);
    expect(findViolations(wide, board).any).toBe(true);
  });
});

describe('the win (§3)', () => {
  it('is the answer drawn, read from the rules', () => {
    expect(isSolved(LAYOUT, SOLUTION)).toBe(true);
    let board = drawRect(initialAssignment(LAYOUT), LAYOUT, 0, 4)!;
    board = drawRect(board, LAYOUT, 2, 5)!;
    expect(isSolved(LAYOUT, board)).toBe(false);
    board = drawRect(board, LAYOUT, 6, 8)!;
    expect(isSolved(LAYOUT, board)).toBe(true);
  });

  it('refuses a full board that breaks a rule, and an empty array', () => {
    expect(isSolved(LAYOUT, [0, 0, 1, 0, 0, 1, 2, 2, 1])).toBe(false);
    expect(isSolved(LAYOUT, [])).toBe(false);
    expect(regionSatisfiesClue([0, 1, 3, 4], LAYOUT, 0)).toBe(true);
    // Holding another clue's cell is never this clue's box.
    const bare: Layout = {
      ...LAYOUT,
      clues: [{ index: 0, size: null, kind: 'free' }, LAYOUT.clues[1]!],
    };
    expect(regionSatisfiesClue([0, 1, 3, 4], bare, 0)).toBe(true);
    expect(regionSatisfiesClue([0, 1, 2, 3, 4, 5], bare, 0)).toBe(false);
  });
});
