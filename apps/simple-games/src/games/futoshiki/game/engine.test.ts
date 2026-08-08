/**
 * Board rules of docs/FUTOSHIKI_RULES.md §2, §3, §4 and §5: the Latin square,
 * the signs, what writing a digit does to the notes around it, the always-on
 * violation display, and the win.
 *
 * Grids are written as rows of characters because that is how a board reads —
 * '.' is an empty cell, and a row of digits is something you can check by eye.
 */
import { describe, expect, it } from 'vitest';
import {
  createBoard,
  digitCount,
  erase,
  findViolations,
  hasNote,
  isComplete,
  isSolved,
  mistakenCells,
  peersOf,
  place,
  remainingForDigit,
  toGrid,
  toggleNote,
} from './engine';
import { EMPTY, type Constraint } from './types';

const grid = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : Number(character)));

/** A finished 4×4: every row and every column holds 1..4 once. */
const SOLUTION = grid('1234', '2341', '3412', '4123');

/** `1 < 2` across the top-left gap, and `2 > 1` down the left edge. */
const SIGNS: Constraint[] = [
  { less: 0, greater: 1 },
  { less: 0, greater: 4 },
];

const boardOf = (...rows: string[]) => createBoard(grid(...rows));

describe('writing a digit (§4)', () => {
  const board = boardOf('1...', '....', '....', '....');

  it('writes into an empty cell and reads back through the grid', () => {
    const result = place(board, 4, 1, 2, SOLUTION)!;
    expect(result.board.entries[1]).toBe(2);
    expect(toGrid(result.board)[1]).toBe(2);
    expect(result.mistake).toBe(false);
    expect(isComplete(result.board)).toBe(false);
  });

  it('counts a digit that disagrees with the answer, and still writes it (§5)', () => {
    const result = place(board, 4, 1, 3, SOLUTION)!;
    expect(result.mistake).toBe(true);
    expect(result.board.entries[1]).toBe(3);
    expect(mistakenCells(result.board, SOLUTION)).toEqual(new Set([1]));
  });

  it('refuses a given, a repeat of what is already there, and an index off the board', () => {
    expect(place(board, 4, 0, 2, SOLUTION)).toBeNull();
    const written = place(board, 4, 1, 2, SOLUTION)!.board;
    expect(place(written, 4, 1, 2, SOLUTION)).toBeNull();
    expect(place(board, 4, -1, 2, SOLUTION)).toBeNull();
    expect(place(board, 4, 16, 2, SOLUTION)).toBeNull();
  });

  /**
   * The bookkeeping that makes this game's undo worth having (§5): a single
   * digit rubs out pencil marks the player made across two whole lines, and no
   * amount of tapping brings them back.
   */
  it('rubs the digit out of every note in its row and its column', () => {
    let noted = board;
    for (const index of [1, 2, 5, 9, 13, 15]) noted = toggleNote(noted, index, 2)!;
    for (const index of [1, 15]) noted = toggleNote(noted, index, 3)!;

    const after = place(noted, 4, 5, 2, SOLUTION)!.board;
    expect(peersOf(4, 5)).toEqual(expect.arrayContaining([1, 4, 6, 7, 9, 13]));
    // Same row as cell 5, same column as cell 5: the note goes.
    expect(hasNote(after, 1, 2)).toBe(false);
    expect(hasNote(after, 9, 2)).toBe(false);
    // Elsewhere it stays, and so does every other digit noted in the same cell.
    expect(hasNote(after, 2, 2)).toBe(true);
    expect(hasNote(after, 15, 2)).toBe(true);
    expect(hasNote(after, 1, 3)).toBe(true);
    // And the cell that took the digit keeps no notes at all.
    expect(after.notes[5]).toBe(0);
  });
});

describe('erasing and noting (§4)', () => {
  const board = boardOf('1...', '....', '....', '....');

  it('clears an entry and its notes together', () => {
    const written = place(board, 4, 5, 2, SOLUTION)!.board;
    const cleared = erase(written, 5)!;
    expect(cleared.entries[5]).toBe(EMPTY);
    expect(cleared.notes[5]).toBe(0);
  });

  it('refuses to erase a given or a cell with nothing in it', () => {
    expect(erase(board, 0)).toBeNull();
    expect(erase(board, 5)).toBeNull();
  });

  it('toggles a note on and off again', () => {
    const on = toggleNote(board, 5, 3)!;
    expect(hasNote(on, 5, 3)).toBe(true);
    expect(hasNote(toggleNote(on, 5, 3)!, 5, 3)).toBe(false);
  });

  it('refuses a note on a given or on a cell that already shows a digit', () => {
    expect(toggleNote(board, 0, 3)).toBeNull();
    const written = place(board, 4, 5, 2, SOLUTION)!.board;
    expect(toggleNote(written, 5, 3)).toBeNull();
  });
});

/**
 * The pad's counter (§4). This invariant exists because every digit appears
 * exactly N times in a finished board — once per row — which is what lets the
 * pad show "how many are left" as a fact rather than an estimate.
 */
describe('how many of a digit are left (§4)', () => {
  it('counts givens and entries together', () => {
    const board = boardOf('1..1', '....', '....', '....');
    expect(digitCount(board, 1)).toBe(2);
    expect(remainingForDigit(board, 4, 1)).toBe(2);
    const written = place(board, 4, 5, 1, SOLUTION)!.board;
    expect(remainingForDigit(written, 4, 1)).toBe(1);
  });
});

describe('the Latin rule (§3, §5)', () => {
  it('flags a digit repeated in a row, and only that digit', () => {
    const violations = findViolations(grid('1.1.', '....', '....', '....'), 4, []);
    expect(violations.any).toBe(true);
    expect(violations.cells).toEqual(new Set([0, 2]));
    expect(violations.constraints.size).toBe(0);
  });

  it('flags a digit repeated in a column', () => {
    const violations = findViolations(grid('2...', '....', '2...', '....'), 4, []);
    expect(violations.cells).toEqual(new Set([0, 8]));
  });

  it('says nothing about the same digit in a different row and column', () => {
    expect(findViolations(grid('1...', '.1..', '....', '....'), 4, []).any).toBe(false);
  });
});

describe('the signs (§3, §5)', () => {
  it('flags a sign whose two cells read the wrong way, and names the sign', () => {
    const violations = findViolations(grid('21..', '....', '....', '....'), 4, SIGNS);
    expect(violations.constraints).toEqual(new Set([0]));
    expect(violations.cells).toEqual(new Set([0, 1]));
  });

  it('says nothing while only one side of a sign is filled', () => {
    expect(findViolations(grid('2...', '....', '....', '....'), 4, SIGNS).any).toBe(false);
    expect(findViolations(grid('.1..', '....', '....', '....'), 4, SIGNS).any).toBe(false);
  });

  it('says nothing when the sign is satisfied', () => {
    expect(findViolations(grid('12..', '3...', '....', '....'), 4, SIGNS).any).toBe(false);
  });

  it('flags two cells that are equal across a sign — equal is not less than', () => {
    // The column repeat is flagged as well; what this pins is that the sign
    // itself complains, which is the half a Latin square would never notice.
    expect(findViolations(grid('1...', '1...', '....', '....'), 4, SIGNS).constraints).toEqual(
      new Set([1]),
    );
  });
});

describe('the win (§2)', () => {
  it('is a full board that keeps the Latin rule and every sign', () => {
    expect(isSolved(SOLUTION, 4, SIGNS)).toBe(true);
  });

  it('is not a board with a cell left empty', () => {
    const unfinished = [...SOLUTION];
    unfinished[7] = EMPTY;
    expect(isSolved(unfinished, 4, SIGNS)).toBe(false);
  });

  it('is not a full Latin square that points a sign the wrong way', () => {
    expect(isSolved(SOLUTION, 4, [{ less: 1, greater: 0 }])).toBe(false);
  });

  it('is not a full board with a digit twice in a line', () => {
    const broken = [...SOLUTION];
    broken[1] = 1;
    expect(isSolved(broken, 4, [])).toBe(false);
  });

  it('is not a grid of the wrong length', () => {
    expect(isSolved(SOLUTION.slice(0, 15), 4, [])).toBe(false);
  });
});
