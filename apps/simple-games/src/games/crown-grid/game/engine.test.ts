/**
 * Board rules of docs/CROWN_GRID_RULES.md §2, §3, §4 and §5: one crown per
 * house, no two touching, the tap cycle, the drag that writes ×, the
 * always-on violation display, and the win.
 *
 * Regions are written as rows of letters and marks as rows of characters
 * because that is how the rules read — a region is something you see.
 */
import { describe, expect, it } from 'vitest';
import {
  crownIndices,
  cycleCell,
  emptyMarks,
  findViolations,
  houseIndices,
  isSolved,
  isValidRegions,
  isValidSolution,
  markCross,
  marksOf,
  neighbours,
  touching,
} from './engine';
import { CROSS, CROWN, EMPTY, type Mark } from './types';

const regions = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => character.charCodeAt(0) - 'a'.charCodeAt(0));

const marks = (...rows: string[]): Mark[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === 'q' ? CROWN : character === 'x' ? CROSS : EMPTY));

/** A 4×4 with four connected regions and exactly one legal answer under them. */
const SMALL = regions('aabb', 'abbb', 'ccdb', 'cddd');
const SMALL_SOLUTION = [1, 3, 0, 2];

describe('the tap cycle (§4)', () => {
  it('runs empty → × → crown → empty and round again', () => {
    let board = emptyMarks(6);
    board = cycleCell(board, 7)!;
    expect(board[7]).toBe(CROSS);
    board = cycleCell(board, 7)!;
    expect(board[7]).toBe(CROWN);
    board = cycleCell(board, 7)!;
    expect(board[7]).toBe(EMPTY);
  });

  it('refuses an index off the board', () => {
    expect(cycleCell(emptyMarks(6), -1)).toBeNull();
    expect(cycleCell(emptyMarks(6), 36)).toBeNull();
  });
});

describe('the drag (§4)', () => {
  it('writes × onto empty cells only, and leaves crowns and ×s alone', () => {
    const board = marks('q.x.', '....', '....', '....');
    const next = markCross(board, [0, 1, 2, 3, 4]);
    expect(next).not.toBeNull();
    expect(next![0]).toBe(CROWN);
    expect(next![1]).toBe(CROSS);
    expect(next![2]).toBe(CROSS);
    expect(next![3]).toBe(CROSS);
    expect(next![4]).toBe(CROSS);
    // The input board is not touched.
    expect(board[1]).toBe(EMPTY);
  });

  it('is null when nothing changes, so the caller saves nothing', () => {
    expect(markCross(marks('qx..', '....', '....', '....'), [0, 1])).toBeNull();
    expect(markCross(emptyMarks(6), [])).toBeNull();
    expect(markCross(emptyMarks(6), [-1, 99])).toBeNull();
  });
});

describe('houses and neighbours (§3)', () => {
  it('lists a row, a column and a region', () => {
    expect(houseIndices(4, SMALL, { kind: 'row', index: 1 })).toEqual([4, 5, 6, 7]);
    expect(houseIndices(4, SMALL, { kind: 'col', index: 2 })).toEqual([2, 6, 10, 14]);
    expect(houseIndices(4, SMALL, { kind: 'region', index: 0 })).toEqual([0, 1, 4]);
  });

  it('counts eight neighbours in the middle and three in a corner', () => {
    expect(neighbours(5, 4)).toEqual([0, 1, 2, 4, 6, 8, 9, 10]);
    expect(neighbours(0, 4)).toEqual([1, 4, 5]);
    expect(touching(0, 5, 4)).toBe(true);
    expect(touching(0, 2, 4)).toBe(false);
    expect(touching(3, 3, 4)).toBe(false);
  });
});

describe('violations (§5)', () => {
  it('flags every crown of a row, column or region that holds two', () => {
    const inRow = findViolations(
      marks('q.q...', '......', '......', '......', '......', '......'),
      regions('aabbcc', 'aabbcc', 'ddeeff', 'ddeeff', 'ddeeff', 'ddeeff'),
      6,
    );
    expect(inRow.any).toBe(true);
    expect(inRow.cells.filter(Boolean)).toHaveLength(2);
    expect([inRow.cells[0], inRow.cells[2]]).toEqual([true, true]);

    const inCol = findViolations(
      marks('q.....', '......', 'q.....', '......', '......', '......'),
      regions('aabbcc', 'aabbcc', 'ddeeff', 'ddeeff', 'ddeeff', 'ddeeff'),
      6,
    );
    expect([inCol.cells[0], inCol.cells[12]]).toEqual([true, true]);

    // Two crowns in one region, in different rows and columns, not touching.
    const inRegion = findViolations(
      marks('q.....', '......', '.q....', '......', '......', '......'),
      regions('aaaaaa', 'aaaaaa', 'aaaaaa', 'bbbbbb', 'bbbbbb', 'bbbbbb'),
      6,
    );
    expect([inRegion.cells[0], inRegion.cells[13]]).toEqual([true, true]);
    expect(inRegion.cells.filter(Boolean)).toHaveLength(2);
  });

  it('flags two crowns that touch, diagonally included', () => {
    const diagonal = findViolations(marks('q...', '.q..', '....', '....'), SMALL, 4);
    expect(diagonal.any).toBe(true);
    expect([diagonal.cells[0], diagonal.cells[5]]).toEqual([true, true]);
  });

  it('says nothing about ×s, or about a legal crown that is not the answer', () => {
    // A crown at (0,0) is not in SMALL's answer, but it breaks no rule yet.
    const quiet = findViolations(marks('qxxx', 'x.x.', '....', '....'), SMALL, 4);
    expect(quiet.any).toBe(false);
  });
});

describe('the win (§2)', () => {
  it('is N crowns with nothing broken, ×s or not', () => {
    const solved = marksOf(SMALL_SOLUTION, 4);
    expect(crownIndices(solved)).toEqual([1, 7, 8, 14]);
    expect(isSolved(solved, SMALL, 4)).toBe(true);
    const withCrosses = markCross(solved, [0, 2, 3, 5])!;
    expect(isSolved(withCrosses, SMALL, 4)).toBe(true);
  });

  it('is not a board a crown short, nor one with a crown too many', () => {
    const short = marksOf(SMALL_SOLUTION, 4);
    short[1] = EMPTY;
    expect(isSolved(short, SMALL, 4)).toBe(false);
    const extra = marksOf(SMALL_SOLUTION, 4);
    extra[3] = CROWN;
    expect(isSolved(extra, SMALL, 4)).toBe(false);
  });

  it('is not four crowns that break a rule', () => {
    // One per row and column and region-count aside, two of them touch.
    expect(isSolved(marks('q...', '..q.', 'q...', '..q.'), SMALL, 4)).toBe(false);
  });

  it('refuses a board of the wrong length rather than calling it empty', () => {
    // `every` on an empty array is true and a short board reads as
    // "no crowns, nothing broken", so without the length check the emptiest
    // possible board could reach the result screen as a win.
    expect(isSolved([], SMALL, 4)).toBe(false);
    expect(isSolved(marksOf(SMALL_SOLUTION, 4).slice(0, -1), SMALL, 4)).toBe(false);
    expect(isSolved(marksOf(SMALL_SOLUTION, 4), SMALL.slice(0, -1), 4)).toBe(false);
  });
});

describe('what a partition has to be (§1, §11)', () => {
  it('accepts N connected regions covering the board', () => {
    expect(isValidRegions(SMALL, 4)).toBe(true);
  });

  it('refuses a region in two pieces, a missing region, and a stray id', () => {
    // Region a appears at (0,0) and (3,3) with nothing joining them.
    expect(isValidRegions(regions('abbb', 'bbbb', 'cccc', 'ccda'), 4)).toBe(false);
    // Only three ids on a 4×4.
    expect(isValidRegions(regions('aabb', 'aabb', 'cccc', 'cccc'), 4)).toBe(false);
    // An id past N.
    expect(isValidRegions(regions('aabb', 'abbb', 'ccdb', 'cdde'), 4)).toBe(false);
    expect(isValidRegions(SMALL.slice(1), 4)).toBe(false);
    expect(isValidRegions('aabbabbbccdbcddd', 4)).toBe(false);
  });
});

describe('what a solution has to be (§3, §11)', () => {
  it('accepts the answer and refuses a column twice, a touch, and two in a region', () => {
    expect(isValidSolution(SMALL_SOLUTION, SMALL, 4)).toBe(true);
    expect(isValidSolution([1, 3, 1, 2], SMALL, 4)).toBe(false);
    expect(isValidSolution([0, 1, 3, 2], SMALL, 4)).toBe(false);
    // One per row and column, no touching — but rows 0 and 1 both land in region b.
    expect(isValidSolution([2, 0, 3, 1], SMALL, 4)).toBe(false);
    expect(isValidSolution([1, 3, 0], SMALL, 4)).toBe(false);
    expect(isValidSolution([1, 3, 0, 4], SMALL, 4)).toBe(false);
  });
});
