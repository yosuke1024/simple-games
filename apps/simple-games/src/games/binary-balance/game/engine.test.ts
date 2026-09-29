/**
 * The board rules of docs/BINARY_BALANCE_RULES.md §2, §3, §4 and §9 — and the
 * one rule this game deliberately does not have (§3, §14).
 */
import { describe, expect, it } from 'vitest';
import {
  allEdges,
  cycleCell,
  emptyMarks,
  findViolations,
  isSolved,
  isValidLinks,
  mergeBoard,
} from './engine';
import { EMPTY, type Link, type Mark } from './types';

/** '0' circle, '1' square, '.' empty, row-major; spaces are ignored. */
const board = (text: string): Mark[] =>
  [...text.replace(/\s/g, '')].map((c) => (c === '0' ? 0 : c === '1' ? 1 : EMPTY));

const link = (dir: 'h' | 'v', index: number, same: boolean): Link => ({ dir, index, same });

/** A legal 6×6 with rows 1 and 2 identical — legal here, illegal in Takuzu. */
const REPEATING = board(`
  010101
  010101
  101010
  101010
  010101
  101010
`);

describe('edges and links (§1, §11)', () => {
  it('counts every edge between neighbours: 60 on the 6×6', () => {
    expect(allEdges(6)).toHaveLength(60);
  });

  it('accepts real edges, once each, and nothing else', () => {
    expect(isValidLinks([link('h', 0, true), link('v', 0, false)], 6)).toBe(true);
    expect(isValidLinks([link('h', 5, true)], 6)).toBe(false); // off the right edge
    expect(isValidLinks([link('v', 30, true)], 6)).toBe(false); // off the bottom
    expect(isValidLinks([link('h', 36, true)], 6)).toBe(false); // off the board
    expect(isValidLinks([link('h', 3, true), link('h', 3, false)], 6)).toBe(false); // twice
  });
});

describe('the tap (§4)', () => {
  it('cycles empty → circle → square → empty', () => {
    const givens = emptyMarks(6);
    let marks: Mark[] = emptyMarks(6);
    marks = cycleCell(givens, marks, 0)!;
    expect(marks[0]).toBe(0);
    marks = cycleCell(givens, marks, 0)!;
    expect(marks[0]).toBe(1);
    marks = cycleCell(givens, marks, 0)!;
    expect(marks[0]).toBe(EMPTY);
  });

  it('never moves a given, and ignores a tap off the board', () => {
    const givens = emptyMarks(6);
    givens[3] = 1;
    expect(cycleCell(givens, emptyMarks(6), 3)).toBeNull();
    expect(cycleCell(givens, emptyMarks(6), 36)).toBeNull();
    expect(cycleCell(givens, emptyMarks(6), -1)).toBeNull();
  });

  it('reads the givens under the player’s marks', () => {
    const givens = emptyMarks(6);
    givens[0] = 1;
    const marks = emptyMarks(6);
    marks[1] = 0;
    expect(mergeBoard(givens, marks).slice(0, 3)).toEqual([1, 0, EMPTY]);
  });
});

describe('violations (§9)', () => {
  it('flags three alike in a row and in a column', () => {
    const across = findViolations(board('000...' + '.'.repeat(30)), [], 6);
    expect(across.cells.slice(0, 4)).toEqual([true, true, true, false]);
    expect(across.rows[0]).toBe(true);

    const down = board('.'.repeat(36));
    down[0] = down[6] = down[12] = 1;
    const result = findViolations(down, [], 6);
    expect([result.cells[0], result.cells[6], result.cells[12]]).toEqual([true, true, true]);
    expect(result.cols[0]).toBe(true);
  });

  it('flags more than half a line before the line is full', () => {
    const result = findViolations(board('00.0.0' + '.'.repeat(30)), [], 6);
    // Four circles in a six-wide row: over half already, so it can never finish.
    expect(result.rows[0]).toBe(true);
    expect(result.cells.slice(0, 7)).toEqual([true, true, false, true, false, true, false]);
  });

  it('flags a link its two cells disagree with, and the link itself', () => {
    const cells = board('01' + '.'.repeat(34));
    const same = findViolations(cells, [link('h', 0, true)], 6);
    expect(same.links).toEqual([true]);
    expect(same.cells.slice(0, 2)).toEqual([true, true]);

    const diff = findViolations(cells, [link('h', 0, false)], 6);
    expect(diff.any).toBe(false);

    const alike = board('11' + '.'.repeat(34));
    expect(findViolations(alike, [link('h', 0, false)], 6).links).toEqual([true]);
  });

  it('says nothing about a half-filled link', () => {
    expect(findViolations(board('1' + '.'.repeat(35)), [link('h', 0, false)], 6).any).toBe(false);
  });

  it('has no "no two lines alike" rule: repeated rows are legal (§3, §14)', () => {
    expect(findViolations(REPEATING, [], 6).any).toBe(false);
    expect(isSolved(REPEATING, [], 6)).toBe(true);
  });
});

describe('the win (§2)', () => {
  it('is a full board with nothing broken — never a comparison with a solution', () => {
    expect(isSolved(REPEATING, [link('h', 0, false), link('v', 0, true)], 6)).toBe(true);
    expect(isSolved(REPEATING, [link('h', 0, true)], 6)).toBe(false);
    const gap = [...REPEATING];
    gap[35] = EMPTY;
    expect(isSolved(gap, [], 6)).toBe(false);
  });

  it('never reads a board of the wrong length as a win', () => {
    expect(isSolved([], [], 6)).toBe(false);
    expect(isSolved(REPEATING.slice(1), [], 6)).toBe(false);
  });
});
