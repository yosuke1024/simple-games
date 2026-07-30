/**
 * The line rule of docs/NONOGRAM_RULES.md §4, pinned case by case: what one
 * line decides, when a line is impossible, and what the hint hands back (§7).
 */
import { describe, expect, it } from 'vitest';
import { computeClues, emptyMarks } from './engine';
import { findHint, solve, solveLine } from './solver';
import { CROSSED, FILLED, UNKNOWN, type Mark } from './types';

const U = UNKNOWN;
const F = FILLED;
const X = CROSSED;

describe('solveLine (§4)', () => {
  it('decides a full line outright', () => {
    const result = solveLine([U, U, U, U, U], [5]);
    expect(result?.decided).toEqual([F, F, F, F, F]);
  });

  it('decides the overlap of a long run', () => {
    // A 4-run in 5 cells paints the middle three in every placement.
    const result = solveLine([U, U, U, U, U], [4]);
    expect(result?.decided).toEqual([U, F, F, F, U]);
  });

  it('crosses the whole of an empty line', () => {
    const result = solveLine([U, U, U], []);
    expect(result?.decided).toEqual([X, X, X]);
  });

  it('decides nothing when every placement stays open', () => {
    const result = solveLine([U, U, U, U, U], [1]);
    expect(result).not.toBeNull();
    expect(result?.changed).toBe(false);
  });

  it('uses crosses and paints already on the line', () => {
    // 2-run in 5 cells, middle crossed: the run fits only on one side of it —
    // nothing decided yet. Paint cell 0 and the run is pinned to the left.
    const open = solveLine([U, U, X, U, U], [2]);
    expect(open?.changed).toBe(false);
    const pinned = solveLine([F, U, X, U, U], [2]);
    expect(pinned?.decided).toEqual([F, F, X, X, X]);
  });

  it('reports an impossible line as null (§7)', () => {
    expect(solveLine([X, X, X], [1])).toBeNull();
    expect(solveLine([F, U, U], [])).toBeNull();
  });

  it('keeps runs maximal — a paint beside a run refuses the placement', () => {
    // [1, 1] in 3 cells has exactly one placement: paint, gap, paint.
    const result = solveLine([U, U, U], [1, 1]);
    expect(result?.decided).toEqual([F, X, F]);
  });
});

describe('solve (§4)', () => {
  it('finishes a line-solvable board from empty marks', () => {
    // A 5×5 with a solid frame row and column structure that lines decide.
    const solution = [
      1, 1, 1, 1, 1,
      1, 0, 0, 0, 1,
      1, 0, 1, 0, 1,
      1, 0, 0, 0, 1,
      1, 1, 1, 1, 1,
    ] as const;
    const clues = computeClues([...solution] as (0 | 1)[], 5);
    const result = solve(emptyMarks(5), clues.rows, clues.cols, 5);
    expect(result.contradiction).toBe(false);
    expect(result.solved).toBe(true);
    result.marks.forEach((mark, i) => {
      expect(mark).toBe(solution[i] === 1 ? F : X);
    });
  });

  it('stops with a contradiction when the marks cannot fit the clues', () => {
    const solution = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] as (0 | 1)[];
    const clues = computeClues(solution, 5);
    const marks = emptyMarks(5);
    marks[0] = X; // The full first row can no longer be painted.
    const result = solve(marks, clues.rows, clues.cols, 5);
    expect(result.contradiction).toBe(true);
  });
});

describe('findHint (§7)', () => {
  const solution = [
    1, 1, 1, 1, 1,
    1, 0, 0, 0, 1,
    1, 0, 1, 0, 1,
    1, 0, 0, 0, 1,
    1, 1, 1, 1, 1,
  ] as (0 | 1)[];
  const clues = computeClues(solution, 5);

  it('offers one decided cell with the line that proves it', () => {
    const hint = findHint(emptyMarks(5), clues.rows, clues.cols, 5);
    expect(hint?.kind).toBe('cell');
    if (hint?.kind === 'cell') {
      expect(solution[hint.index] === 1 ? F : X).toBe(hint.mark);
    }
  });

  it('points at the broken line instead when the marks contradict a clue', () => {
    const marks: Mark[] = emptyMarks(5);
    // Cross the entire first row: its 5-clue has nowhere left to go.
    for (let i = 0; i < 5; i++) marks[i] = X;
    const hint = findHint(marks, clues.rows, clues.cols, 5);
    expect(hint?.kind).toBe('contradiction');
  });

  it('finds nothing on a solved board', () => {
    const marks = solution.map((cell) => (cell === 1 ? F : X));
    const hint = findHint(marks, clues.rows, clues.cols, 5);
    expect(hint).toBeNull();
  });
});
