/**
 * Board transitions (docs/SUDOKU_RULES.md §3) — here, the completion signal:
 * which rows, columns and boxes a digit finishes the moment it lands.
 */
import { describe, expect, it } from 'vitest';
import { createBoard, place, unitsCompletedBy } from './engine';
import { generatePuzzle } from './generator';
import { indexOf, type Digit } from './types';

/** A solved grid with one cell blanked, so one digit finishes three units. */
function boardMissing(index: number) {
  const puzzle = generatePuzzle('sudoku-engine-test', 'easy');
  const givens = puzzle.solution.map((value, i) => (i === index ? 0 : value));
  return { board: createBoard(givens), solution: puzzle.solution };
}

describe('unitsCompletedBy (§3)', () => {
  it('names the row, column and box a last digit finishes', () => {
    const index = indexOf(4, 4);
    const { board, solution } = boardMissing(index);
    const finished = unitsCompletedBy(board, index, solution[index]! as Digit);
    expect(finished.map((unit) => unit.kind).sort()).toEqual(['box', 'col', 'row']);
    expect(finished.every((unit) => unit.cells.includes(index))).toBe(true);
  });

  it('is about nine distinct digits, not the solution', () => {
    // A row with eight digits placed: the ninth finishes it whatever the
    // solution says, and a repeat of one already there finishes nothing.
    const givens = new Array<number>(81).fill(0);
    for (let col = 0; col < 8; col++) givens[indexOf(0, col)] = col + 1;
    const board = createBoard(givens);
    expect(unitsCompletedBy(board, indexOf(0, 8), 9).map((u) => u.kind)).toEqual(['row']);
    expect(unitsCompletedBy(board, indexOf(0, 8), 1)).toEqual([]);
  });

  it('never fires for a clue cell or an incomplete unit', () => {
    const { board, solution } = boardMissing(indexOf(2, 7));
    expect(unitsCompletedBy(board, indexOf(0, 0), 5)).toEqual([]);
    // Two cells missing from a row: writing one of them leaves it open.
    const givens = [...board.givens];
    givens[indexOf(2, 0)] = 0;
    const twoOpen = createBoard(givens);
    const digit = solution[indexOf(2, 7)]! as Digit;
    expect(unitsCompletedBy(twoOpen, indexOf(2, 7), digit).map((u) => u.kind)).not.toContain('row');
  });

  it('agrees with the board the placement actually produces', () => {
    const index = indexOf(8, 8);
    const { board, solution } = boardMissing(index);
    const digit = solution[index]! as Digit;
    const finished = unitsCompletedBy(board, index, digit);
    const after = place(board, index, digit, solution)!.board;
    for (const unit of finished) {
      const values = unit.cells.map((cell) => after.givens[cell] || after.entries[cell]);
      expect(new Set(values).size).toBe(9);
    }
  });
});
