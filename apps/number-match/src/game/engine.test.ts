import { describe, expect, it } from 'vitest';
import { addNumbers, applyMatch, canAddNumbers, collapseBoard, getStatus } from './engine';
import { makeBoard } from './test-helpers';

describe('applyMatch', () => {
  it('clears a valid pair', () => {
    const board = makeBoard('19555');
    const next = applyMatch(board, 0, 1);
    expect(next).not.toBeNull();
    expect(next![0]!.cleared).toBe(true);
    expect(next![1]!.cleared).toBe(true);
    expect(next![2]!.cleared).toBe(false);
  });

  it('returns null for an invalid pair', () => {
    const board = makeBoard('129');
    expect(applyMatch(board, 0, 2)).toBeNull();
  });

  it('removes a complete row once fully cleared', () => {
    const board = makeBoard('11.......', '234567892');
    const next = applyMatch(board, 0, 1);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(9);
    expect(next![0]!.value).toBe(2);
  });

  it('trims trailing cleared cells of a partial row', () => {
    const board = makeBoard('123456788', '11');
    const next = applyMatch(board, 9, 10);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(9);
  });
});

describe('collapseBoard', () => {
  it('removes multiple fully cleared complete rows at once', () => {
    const board = makeBoard('.........', '123456789', '.........');
    const next = collapseBoard(board);
    expect(next.length).toBe(9);
    expect(next[0]!.value).toBe(1);
  });

  it('keeps cleared cells inside partially cleared rows', () => {
    const board = makeBoard('1.3456789');
    expect(collapseBoard(board).length).toBe(9);
  });

  it('collapses an entirely cleared board to empty', () => {
    const board = makeBoard('.........', '...');
    expect(collapseBoard(board).length).toBe(0);
  });
});

describe('addNumbers', () => {
  it('appends remaining live numbers in reading order, skipping cleared cells', () => {
    const board = makeBoard('1.2');
    const next = addNumbers(board);
    expect(next).not.toBeNull();
    expect(next!.length).toBe(5);
    expect(next!.map((c) => (c.cleared ? '.' : String(c.value))).join('')).toBe('1.212');
  });

  it('returns null when the result would exceed the maximum board size', () => {
    const board = makeBoard('1.2');
    expect(canAddNumbers(board, 4)).toBe(false);
    expect(addNumbers(board, 4)).toBeNull();
  });

  it('allows reaching exactly the maximum board size', () => {
    const board = makeBoard('1.2');
    expect(addNumbers(board, 5)).not.toBeNull();
  });

  it('returns null when no live numbers remain', () => {
    const board = makeBoard('...');
    expect(addNumbers(board)).toBeNull();
  });
});

describe('getStatus', () => {
  it('reports cleared when no live cells remain', () => {
    expect(getStatus(makeBoard('...'))).toBe('cleared');
    expect(getStatus([])).toBe('cleared');
  });

  it('reports playing when a valid pair exists', () => {
    expect(getStatus(makeBoard('19'))).toBe('playing');
  });

  it('reports playing when no pair exists but Add Numbers is possible', () => {
    expect(getStatus(makeBoard('12'))).toBe('playing');
  });

  it('reports game over when no pair exists and Add Numbers is impossible', () => {
    // 1 and 2: no match; adding 2 cells to a 2-cell board would exceed max 3.
    expect(getStatus(makeBoard('12'), 3)).toBe('gameOver');
  });
});
