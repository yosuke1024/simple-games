/**
 * The words beside the board (§5, §6): which rule the marks break, named in a
 * fixed order and read from the rules alone; and the sentence for each kind
 * of hint. Every board here is built by hand on a 3×3 lattice, so each case
 * breaks exactly the rule it names.
 */
import { describe, expect, it } from 'vitest';
import {
  CROSS,
  LINE,
  UNKNOWN,
  dotIndex,
  gridFor,
  horizontalEdge,
  verticalEdge,
  type Clue,
  type Hint,
  type LoopPuzzleSession,
  type Mark,
} from '../game';
import { conflictMessageKey, hintMessageKey } from './feedback';

const W = 3;
const grid = gridFor(W, W);

/** A 3×3 session with these clues and these edges marked. */
function board(clues: readonly Clue[], lines: readonly number[], crosses: readonly number[] = []) {
  const marks = new Array<Mark>(grid.edgeCount).fill(UNKNOWN);
  for (const edge of lines) marks[edge] = LINE;
  for (const edge of crosses) marks[edge] = CROSS;
  return {
    mode: 'difficulty',
    seed: 'hand-made',
    difficulty: 'easy',
    dailyDate: null,
    width: W,
    height: W,
    clues,
    solution: marks,
    marks,
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
    hinted: [],
    lastHint: null,
  } as LoopPuzzleSession;
}

const blank: Clue[] = new Array<Clue>(W * W).fill(null);
const withClue = (cell: number, clue: number): Clue[] =>
  blank.map((value, index) => (index === cell ? clue : value));
const h = (r: number, c: number) => horizontalEdge(grid, r, c);
const v = (r: number, c: number) => verticalEdge(grid, r, c);
/** The four sides of cell (r, c). */
const around = (r: number, c: number) => [h(r, c), v(r, c + 1), h(r + 1, c), v(r, c)];

describe('conflictMessageKey (§5)', () => {
  it('says nothing about a board that breaks no rule — wrong or not', () => {
    expect(conflictMessageKey(board(blank, []))).toBeNull();
    expect(conflictMessageKey(board(blank, [h(0, 0), h(0, 1)]))).toBeNull();
  });

  it('names a branch first: a dot with three lines', () => {
    // Dot (1, 1) with lines up, left and right — and a too-full 0 beside it.
    const lines = [v(0, 1), h(1, 0), h(1, 1)];
    expect(dotIndex(grid, 1, 1)).toBeGreaterThan(0);
    expect(conflictMessageKey(board(withClue(0, 0), lines))).toBe('loopPuzzleConflictBranch');
  });

  it('names a closed loop that leaves other lines out', () => {
    const lines = [...around(0, 0), h(3, 2)];
    expect(conflictMessageKey(board(blank, lines))).toBe('loopPuzzleConflictLoop');
  });

  it('names a number with more lines than it shows', () => {
    expect(conflictMessageKey(board(withClue(4, 1), [h(1, 1), v(1, 2)]))).toBe(
      'loopPuzzleConflictTooMany',
    );
  });

  it('names a dead end: one line into a dot with every other way crossed out', () => {
    // Dot (1, 1): a line comes in from above, the other three ways are ×.
    const crosses = [h(1, 0), h(1, 1), v(1, 1)];
    expect(conflictMessageKey(board(blank, [v(0, 1)], crosses))).toBe('loopPuzzleConflictDeadEnd');
  });

  it('names a number that can no longer get enough lines', () => {
    const [top, right, bottom] = around(1, 1);
    expect(conflictMessageKey(board(withClue(4, 2), [], [top!, right!, bottom!]))).toBe(
      'loopPuzzleConflictTooFew',
    );
  });

  it('names a closed loop that leaves a number short', () => {
    // The loop around cell 0 alone; the 3 in the far corner gets nothing.
    expect(conflictMessageKey(board(withClue(8, 3), around(0, 0)))).toBe(
      'loopPuzzleConflictClosed',
    );
  });
});

describe('hintMessageKey (§6)', () => {
  const step = (mark: Mark, kind: 'cell' | 'dot' | 'loop' | 'trial', index = 0): Hint => ({
    kind: 'step',
    step: { edge: 0, mark, level: 1, anchor: { kind, index } },
  });

  it('says which mark is wrong, without saying what the answer is beyond it', () => {
    expect(hintMessageKey({ kind: 'wrong', edge: 0, mark: LINE })).toBe('loopPuzzleHintWrongLine');
    expect(hintMessageKey({ kind: 'wrong', edge: 0, mark: CROSS })).toBe(
      'loopPuzzleHintWrongCross',
    );
  });

  it('names where a deduction was read, and what it decides', () => {
    expect(hintMessageKey(step(LINE, 'cell'))).toBe('loopPuzzleHintCellLine');
    expect(hintMessageKey(step(CROSS, 'cell'))).toBe('loopPuzzleHintCellCross');
    expect(hintMessageKey(step(LINE, 'dot'))).toBe('loopPuzzleHintDotLine');
    expect(hintMessageKey(step(CROSS, 'dot'))).toBe('loopPuzzleHintDotCross');
    expect(hintMessageKey(step(CROSS, 'loop', 5))).toBe('loopPuzzleHintLoopCross');
    expect(hintMessageKey(step(CROSS, 'loop', -1))).toBe('loopPuzzleHintClosedCross');
    expect(hintMessageKey(step(LINE, 'trial'))).toBe('loopPuzzleHintTrialLine');
    expect(hintMessageKey(step(CROSS, 'trial'))).toBe('loopPuzzleHintTrialCross');
  });

  it('says plainly when it shows an edge of the answer', () => {
    expect(hintMessageKey({ kind: 'reveal', edge: 0, mark: LINE })).toBe(
      'loopPuzzleHintRevealLine',
    );
    expect(hintMessageKey({ kind: 'reveal', edge: 0, mark: CROSS })).toBe(
      'loopPuzzleHintRevealCross',
    );
  });
});
