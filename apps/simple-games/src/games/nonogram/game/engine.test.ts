/**
 * Board rules of docs/NONOGRAM_RULES.md §1–§3: clues, marks, and the win.
 */
import { describe, expect, it } from 'vitest';
import {
  clueOfLine,
  computeClues,
  emptyMarks,
  isSolved,
  lineSatisfied,
  rowIndices,
  toggleCross,
  togglePaint,
} from './engine';
import { CROSSED, FILLED, UNKNOWN, type Cell, type Mark } from './types';

describe('clues (§1)', () => {
  it('reads runs in order', () => {
    expect(clueOfLine([1, 1, 0, 1, 0])).toEqual([2, 1]);
    expect(clueOfLine([0, 0, 0, 0, 0])).toEqual([]);
    expect(clueOfLine([1, 1, 1, 1, 1])).toEqual([5]);
  });

  it('computes every row and column', () => {
    const solution: Cell[] = [
      1, 0, 1,
      1, 1, 0,
      0, 1, 0,
    ] as Cell[];
    // 3 is not a shipping size, but the line math does not care.
    const clues = computeClues(solution, 3);
    expect(clues.rows).toEqual([[1, 1], [2], [1]]);
    expect(clues.cols).toEqual([[2], [2], [1]]);
  });
});

describe('marks and the win (§2, §3)', () => {
  it('toggle paints, toggle crosses, and the newest intent wins', () => {
    let marks = emptyMarks(5);
    marks = togglePaint(marks, 0)!;
    expect(marks[0]).toBe(FILLED);
    marks = toggleCross(marks, 0)!;
    expect(marks[0]).toBe(CROSSED);
    marks = toggleCross(marks, 0)!;
    expect(marks[0]).toBe(UNKNOWN);
    expect(togglePaint(marks, 99)).toBeNull();
  });

  it('a line satisfies its clue only when the runs read exactly', () => {
    const marks: Mark[] = [FILLED, FILLED, UNKNOWN, CROSSED, FILLED] as Mark[];
    expect(lineSatisfied(marks, rowIndices(5, 0), [2, 1])).toBe(true);
    expect(lineSatisfied(marks, rowIndices(5, 0), [2])).toBe(false);
    expect(lineSatisfied(marks, rowIndices(5, 0), [1, 1, 1])).toBe(false);
  });

  it('wins by the clues, with crosses playing no part (§2)', () => {
    const solution: Cell[] = [
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 1, 0, 1,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
    ] as Cell[];
    const clues = computeClues(solution, 5);
    // Paint exactly the solution; leave every empty cell unknown — no crosses.
    const marks = solution.map((cell) => (cell === 1 ? FILLED : UNKNOWN)) as Mark[];
    expect(isSolved(marks, clues, 5)).toBe(true);
    const broken = [...marks];
    broken[6] = FILLED;
    expect(isSolved(broken, clues, 5)).toBe(false);
  });
});
