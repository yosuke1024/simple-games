import { describe, expect, it } from 'vitest';
import { COLS } from './constants';
import { addNumbers, applyMatch, applyMatchDetailed, canAddNumbers, collapseBoard, getStatus } from './engine';
import { RECTANGLE } from './shapes';
import { liveValues, makeBoard } from './test-helpers';
import { isLive } from './types';

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
    expect(applyMatch(makeBoard('129'), 0, 2)).toBeNull();
  });

  it('removes a row once it holds no live numbers', () => {
    const board = makeBoard('11.......', '234567892');
    const result = applyMatchDetailed(board, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.rowsRemoved).toBe(1);
    expect(result!.board.length).toBe(COLS);
    expect(result!.board[0]!.value).toBe(2);
  });

  it('removes a short shaped row by its own width, not by nine cells', () => {
    // Second row is 2 wide (the rest are holes); clearing both empties it.
    const board = makeBoard('123456789', '11');
    const result = applyMatchDetailed(board, 9, 10);
    expect(result).not.toBeNull();
    expect(result!.rowsRemoved).toBe(1);
    expect(result!.board.length).toBe(COLS);
  });

  it('connects across holes, which are transparent like cleared cells', () => {
    // 7, three holes, 7 — a pair across the gap in the board's outline.
    const board = makeBoard('7###7');
    expect(applyMatch(board, 0, 4)).not.toBeNull();
  });
});

describe('collapseBoard', () => {
  it('removes several empty rows at once', () => {
    const board = makeBoard('.........', '123456789', '.........');
    const next = collapseBoard(board);
    expect(next.length).toBe(COLS);
    expect(next[0]!.value).toBe(1);
  });

  it('keeps cleared cells inside rows that still hold a number', () => {
    expect(collapseBoard(makeBoard('1.3456789')).length).toBe(COLS);
  });

  it('collapses an entirely cleared board to empty', () => {
    expect(collapseBoard(makeBoard('.........', '...')).length).toBe(0);
  });

  it('removes a row made only of holes', () => {
    expect(collapseBoard(makeBoard('123456789', '#########')).length).toBe(COLS);
  });
});

describe('addNumbers', () => {
  it('appends the remaining live numbers in reading order, skipping cleared cells', () => {
    const board = makeBoard('1.2');
    const next = addNumbers(board);
    expect(next).not.toBeNull();
    expect(liveValues(next!)).toEqual([1, 2, 1, 2]);
  });

  it('appends as whole rows so the grid stays aligned', () => {
    const next = addNumbers(makeBoard('1.2'))!;
    expect(next.length % COLS).toBe(0);
    expect(next.length).toBe(2 * COLS);
  });

  it('shapes the appended rows too', () => {
    // 12 numbers appended into a [3, 9] cycle → rows of 3 then 9.
    const board = makeBoard('123456789', '123');
    const next = addNumbers(board, [3, 9])!;
    const appended = next.slice(2 * COLS);
    expect(appended.length).toBe(2 * COLS);
    // First appended row is 3 wide, centered.
    const firstRow = appended.slice(0, COLS);
    expect(firstRow.filter((c) => isLive(c))).toHaveLength(3);
    expect(firstRow[0]).toBeNull();
    expect(firstRow[COLS - 1]).toBeNull();
  });

  it('returns null when the result would exceed the maximum board size', () => {
    const board = makeBoard('1.2');
    expect(canAddNumbers(board, RECTANGLE, COLS)).toBe(false);
    expect(addNumbers(board, RECTANGLE, COLS)).toBeNull();
  });

  it('allows reaching exactly the maximum board size', () => {
    expect(addNumbers(makeBoard('1.2'), RECTANGLE, 2 * COLS)).not.toBeNull();
  });

  it('returns null when no live numbers remain', () => {
    expect(addNumbers(makeBoard('...'))).toBeNull();
  });
});

describe('getStatus', () => {
  it('reports cleared when no live cells remain', () => {
    expect(getStatus(makeBoard('...'))).toBe('cleared');
    expect(getStatus([])).toBe('cleared');
    expect(getStatus(makeBoard('###'))).toBe('cleared');
  });

  it('reports playing when a valid pair exists', () => {
    expect(getStatus(makeBoard('19'))).toBe('playing');
  });

  it('reports playing when no pair exists but Add Numbers is possible', () => {
    expect(getStatus(makeBoard('12'))).toBe('playing');
  });

  it('reports game over when no pair exists and Add Numbers is impossible', () => {
    // 1 and 2 never match, and appending would need a second row.
    expect(getStatus(makeBoard('12'), RECTANGLE, COLS)).toBe('gameOver');
  });
});
