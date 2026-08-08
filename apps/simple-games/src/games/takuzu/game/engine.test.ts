/**
 * Board rules of docs/TAKUZU_RULES.md §2, §3, §4 and §9: the three rules, the
 * tap cycle, the always-on violation display, and the win.
 *
 * Boards are written as rows of characters because that is how the rules read
 * — a triple is something you see, and `['0','0','0']` in an array literal is
 * not. '.' is an empty cell.
 */
import { describe, expect, it } from 'vitest';
import { cycleCell, emptyMarks, findViolations, isSolved, mergeBoard } from './engine';
import { buildSolution } from './generator';
import { EMPTY, ONE, ZERO, type Mark } from './types';

const board = (...rows: string[]): Mark[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : character === '0' ? ZERO : ONE));

/** A finished 6×6: every line half and half, no triple, no line twice. */
const SOLVED = board('001011', '110100', '011001', '100110', '010101', '101010');

const blank = (): Mark[] => emptyMarks(6);

describe('the tap cycle (§4)', () => {
  it('runs empty → 0 → 1 → empty and round again', () => {
    const givens = blank();
    let marks = blank();
    marks = cycleCell(givens, marks, 7)!;
    expect(marks[7]).toBe(ZERO);
    marks = cycleCell(givens, marks, 7)!;
    expect(marks[7]).toBe(ONE);
    marks = cycleCell(givens, marks, 7)!;
    expect(marks[7]).toBe(EMPTY);
  });

  it('refuses a given and an index off the board', () => {
    const givens = blank();
    givens[3] = ONE;
    expect(cycleCell(givens, blank(), 3)).toBeNull();
    expect(cycleCell(givens, blank(), -1)).toBeNull();
    expect(cycleCell(givens, blank(), 36)).toBeNull();
  });

  it('reads the givens through the player’s marks', () => {
    const givens = blank();
    givens[0] = ONE;
    const marks = blank();
    marks[1] = ZERO;
    const merged = mergeBoard(givens, marks);
    expect(merged[0]).toBe(ONE);
    expect(merged[1]).toBe(ZERO);
    expect(merged[2]).toBe(EMPTY);
  });
});

describe('rule 1 — never three the same (§3, §9)', () => {
  it('flags a triple in the top-left corner, across and down', () => {
    const across = findViolations(
      board('000...', '......', '......', '......', '......', '......'),
      6,
    );
    expect(across.cells.filter(Boolean)).toHaveLength(3);
    expect([across.cells[0], across.cells[1], across.cells[2]]).toEqual([true, true, true]);
    expect(across.rows[0]).toBe(true);
    expect(across.cols[0]).toBe(false);

    const down = findViolations(
      board('1.....', '1.....', '1.....', '......', '......', '......'),
      6,
    );
    expect(down.cols[0]).toBe(true);
    expect(down.rows[0]).toBe(false);
    expect([down.cells[0], down.cells[6], down.cells[12]]).toEqual([true, true, true]);
  });

  it('flags a triple in the bottom-right corner, across and down', () => {
    const across = findViolations(
      board('......', '......', '......', '......', '......', '...111'),
      6,
    );
    expect(across.rows[5]).toBe(true);
    expect([across.cells[33], across.cells[34], across.cells[35]]).toEqual([true, true, true]);

    const down = findViolations(
      board('......', '......', '......', '.....0', '.....0', '.....0'),
      6,
    );
    expect(down.cols[5]).toBe(true);
    expect([down.cells[23], down.cells[29], down.cells[35]]).toEqual([true, true, true]);
  });

  it('leaves a pair and a spaced-out triple alone', () => {
    expect(
      findViolations(board('11....', '......', '......', '......', '......', '......'), 6).any,
    ).toBe(false);
    expect(
      findViolations(board('1.1.1.', '......', '......', '......', '......', '......'), 6).any,
    ).toBe(false);
  });
});

describe('rule 2 — half and half (§3, §9)', () => {
  it('flags a line already over its share, and only the cells holding it', () => {
    // Four ones in six cells, arranged so no triple can take the blame.
    const violations = findViolations(
      board('110110', '......', '......', '......', '......', '......'),
      6,
    );
    expect(violations.rows[0]).toBe(true);
    expect([0, 1, 3, 4].map((index) => violations.cells[index])).toEqual([true, true, true, true]);
    expect([2, 5].map((index) => violations.cells[index])).toEqual([false, false]);
  });

  it('says nothing while a line is still filling within its share', () => {
    expect(
      findViolations(board('1.0.1.', '......', '......', '......', '......', '......'), 6).any,
    ).toBe(false);
  });
});

describe('rule 3 — no line twice (§3, §9)', () => {
  it('flags two finished rows that read the same', () => {
    const violations = findViolations(
      board('010101', '010101', '......', '......', '......', '......'),
      6,
    );
    expect(violations.rows[0]).toBe(true);
    expect(violations.rows[1]).toBe(true);
    expect(violations.cells.filter(Boolean)).toHaveLength(12);
    expect(violations.cols.some(Boolean)).toBe(false);
  });

  it('flags two finished columns that read the same', () => {
    const violations = findViolations(
      board('00....', '11....', '00....', '11....', '00....', '11....'),
      6,
    );
    expect([violations.cols[0], violations.cols[1]]).toEqual([true, true]);
    expect(violations.rows.some(Boolean)).toBe(false);
  });

  it('leaves two unfinished rows that match so far alone', () => {
    // Identical prefixes are not a repeat of anything yet — they still have
    // four cells each to differ in.
    expect(
      findViolations(board('01....', '......', '......', '01....', '......', '......'), 6).any,
    ).toBe(false);
  });
});

describe('the win (§2)', () => {
  it('is a full board with nothing broken', () => {
    expect(isSolved(SOLVED, 6)).toBe(true);
  });

  it('is not a board with a cell left empty', () => {
    const unfinished = [...SOLVED];
    unfinished[17] = EMPTY;
    expect(isSolved(unfinished, 6)).toBe(false);
  });

  it('is not a full board that breaks a rule', () => {
    // Swapping two cells of one row keeps it half and half, and makes a triple.
    const broken = [...SOLVED];
    broken[0] = ONE;
    broken[2] = ZERO;
    expect(isSolved(broken, 6)).toBe(false);
    expect(findViolations(broken, 6).any).toBe(true);
  });
});

describe('a board of the wrong length is not a win (§2)', () => {
  // `every` on an empty array is true and a short board reads as all-empty, so
  // without an explicit length check the emptiest possible board is "solved" —
  // which is how a generator that returned nothing would reach the result
  // screen as a win rather than as a crash.
  it('refuses an empty board', () => {
    expect(isSolved([], 6)).toBe(false);
    expect(isSolved([], 8)).toBe(false);
    expect(isSolved([], 10)).toBe(false);
  });

  it('refuses a board that is short by one cell', () => {
    const solved = buildSolution('takuzu-level-1', 6) as Mark[] | null;
    expect(solved).not.toBeNull();
    expect(isSolved(solved!, 6)).toBe(true);
    expect(isSolved(solved!.slice(0, -1), 6)).toBe(false);
  });
});
