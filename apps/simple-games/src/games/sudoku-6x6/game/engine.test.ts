/**
 * The board rules of docs/SUDOKU_6X6_RULES.md §1–§4, on a fixed solved grid.
 */
import { describe, expect, it } from 'vitest';
import {
  conflictingCells,
  createBoard,
  digitCount,
  erase,
  isSolved,
  mistakenCells,
  place,
  toggleNote,
  unitsCompletedBy,
  valueAt,
  type Board,
} from './engine';
import { gridFromString } from './generator';
import { BOXES, boxOf, indexOf, PEERS, type Digit } from './types';

const SOLUTION = gridFromString('324561561423135246246315652134413652')!;

/** The solution with the listed cells emptied. */
const givensWithout = (...cells: number[]) =>
  SOLUTION.map((value, index) => (cells.includes(index) ? 0 : value));

describe('the board (§1)', () => {
  it('has six 2×3 boxes, three bands of two side by side', () => {
    expect(boxOf(indexOf(0, 0))).toBe(0);
    expect(boxOf(indexOf(1, 2))).toBe(0);
    expect(boxOf(indexOf(0, 3))).toBe(1);
    expect(boxOf(indexOf(2, 0))).toBe(2);
    expect(boxOf(indexOf(3, 5))).toBe(3);
    expect(boxOf(indexOf(5, 5))).toBe(5);
    expect(BOXES[0]).toEqual([0, 1, 2, 6, 7, 8]);
    expect(PEERS[0]).toHaveLength(12);
  });
});

describe('placing and erasing (§3)', () => {
  it('never changes a given', () => {
    const board = createBoard(givensWithout(0));
    expect(place(board, 1, 1, SOLUTION)).toBeNull();
    expect(erase(board, 1)).toBeNull();
    expect(toggleNote(board, 1, 1)).toBeNull();
  });

  it('clears the cell’s notes and the same digit from peer notes', () => {
    let board: Board = createBoard(givensWithout(0, 1, 6, 35));
    board = toggleNote(board, 0, 3)!;
    board = toggleNote(board, 1, 3)!;
    board = toggleNote(board, 1, 2)!;
    board = toggleNote(board, 6, 3)!;
    board = toggleNote(board, 35, 3)!;
    const result = place(board, 0, 3, SOLUTION)!;
    expect(result.mistake).toBe(false);
    expect(result.board.notes[0]).toBe(0);
    // Peers lose the 3, keep the rest; a cell outside the peers keeps its 3.
    expect(result.board.notes[1]).toBe(0b10);
    expect(result.board.notes[6]).toBe(0);
    expect(result.board.notes[35]).toBe(0b100);
  });

  it('counts a wrong digit as a mistake but lets it stand (§4)', () => {
    const board = createBoard(givensWithout(0, 1));
    const result = place(board, 0, 2, SOLUTION)!;
    expect(result.mistake).toBe(true);
    expect(valueAt(result.board, 0)).toBe(2);
    expect(mistakenCells(result.board, SOLUTION)).toEqual(new Set([0]));
    // The 2 repeats the given 2 in the row: shown always, as a broken rule.
    expect(conflictingCells(result.board).has(0)).toBe(true);
    expect(conflictingCells(result.board).has(1)).toBe(false);
  });

  it('refuses the same digit twice, and a note on a filled cell', () => {
    const board = place(createBoard(givensWithout(0)), 0, 3, SOLUTION)!.board;
    expect(place(board, 0, 3, SOLUTION)).toBeNull();
    expect(toggleNote(board, 0, 1)).toBeNull();
  });

  it('erases an entry back to empty, notes gone too, and refuses an empty cell', () => {
    const board = place(createBoard(givensWithout(0)), 0, 3, SOLUTION)!.board;
    const erased = erase(board, 0)!;
    expect(valueAt(erased, 0)).toBe(0);
    expect(erased.notes[0]).toBe(0);
    expect(erase(erased, 0)).toBeNull();
  });

  it('counts each digit on the board for the pad', () => {
    const board = createBoard(givensWithout(0, 1));
    expect(digitCount(board, 3 as Digit)).toBe(5);
    expect(digitCount(board, 2 as Digit)).toBe(5);
    expect(digitCount(board, 1 as Digit)).toBe(6);
  });
});

describe('finishing (§2, §3)', () => {
  it('names the units the last digit completes, before it lands', () => {
    const board = createBoard(givensWithout(0));
    const units = unitsCompletedBy(board, 0, 3);
    expect(units.map((unit) => unit.kind).sort()).toEqual(['box', 'col', 'row']);
    // A wrong digit completes nothing: six distinct digits are the rule.
    expect(unitsCompletedBy(board, 0, 2)).toEqual([]);
  });

  it('is solved by a full board with no repeat, and not before', () => {
    const board = createBoard(givensWithout(0));
    expect(isSolved(board)).toBe(false);
    expect(isSolved(place(board, 0, 3, SOLUTION)!.board)).toBe(true);
    expect(isSolved(place(board, 0, 2, SOLUTION)!.board)).toBe(false);
  });
});
