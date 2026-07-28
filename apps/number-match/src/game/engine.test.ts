import { describe, expect, it } from 'vitest';
import { COLS } from './constants';
import { addNumbers, applyMatch, applyMatchDetailed, canAddNumbers, collapseBoard, getStatus } from './engine';
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

  it("preserves each number's column when a row above it is removed", () => {
    // A row is exactly COLS slots, so dropping one shifts everything below by
    // exactly one row — vertical and diagonal neighbours stay lined up.
    // Row 0 avoids the digit 7 so the search below can only find the marker.
    const board = makeBoard('888888888', '.........', '###7');
    const before = board.findIndex((c) => c !== null && !c.cleared && c.value === 7);
    expect(before % COLS).toBe(3);
    const next = collapseBoard(board);
    const after = next.findIndex((c) => c !== null && !c.cleared && c.value === 7);
    expect(after % COLS).toBe(3);
    expect(Math.floor(after / COLS)).toBe(1);
  });

  it('never compacts columns: a fully cleared column stays as empty cells', () => {
    // Columns are only a consequence of where a number sits in reading order,
    // so removing one would renumber every following cell and break the
    // row-end → next-row-start rule. Cleared cells simply stay transparent.
    const board = makeBoard('1.3456789', '1.3456789');
    const next = collapseBoard(board);
    expect(next.length).toBe(2 * COLS);
    expect(next[1]).toEqual({ value: 1, cleared: true });
    expect(next[COLS + 1]).toEqual({ value: 1, cleared: true });
  });
});

describe('addNumbers', () => {
  it('appends the remaining live numbers in reading order, skipping cleared cells', () => {
    const board = makeBoard('1.2');
    const next = addNumbers(board);
    expect(next).not.toBeNull();
    expect(liveValues(next!)).toEqual([1, 2, 1, 2]);
  });

  it('finishes the last row before opening a new one', () => {
    // 3 cells used of a 9-wide row; the two appended numbers fit in the gap.
    const next = addNumbers(makeBoard('1.2'))!;
    expect(next.length).toBe(COLS);
    expect(liveValues(next)).toEqual([1, 2, 1, 2]);
  });

  it('keeps the grid aligned when the numbers spill past the last row', () => {
    const board = makeBoard('123456789', '12345');
    const next = addNumbers(board)!;
    expect(next.length % COLS).toBe(0);
    // 14 numbers: 4 finish row 1, the other 10 start fresh rows.
    expect(liveValues(next)).toHaveLength(28);
  });

  it('does not fill a shaped row past its own width', () => {
    // A 3-wide centred row: the holes on either side belong to the shape.
    const board = makeBoard('123456789', '###12');
    const next = addNumbers(board)!;
    const secondRow = next.slice(COLS, 2 * COLS);
    // Only the one slot left inside the 3-wide band gets filled.
    expect(secondRow.filter((c) => c !== null)).toHaveLength(3);
    expect(secondRow[0]).toBeNull();
    expect(secondRow[COLS - 1]).toBeNull();
  });

  it('appends plain full-width rows — only the starting board is shaped', () => {
    const board = makeBoard('123456789', '###12');
    const next = addNumbers(board)!;
    const appended = next.slice(2 * COLS);
    // 11 numbers: 1 finishes the 3-wide row, 10 spill into plain rows.
    expect(appended.filter((c) => isLive(c))).toHaveLength(10);
    expect(appended.slice(0, COLS).every((c) => isLive(c))).toBe(true);
  });

  it('returns null when the result would exceed the maximum board size', () => {
    const board = makeBoard('123456789', '12345');
    expect(canAddNumbers(board, 2 * COLS)).toBe(false);
    expect(addNumbers(board, 2 * COLS)).toBeNull();
  });

  it('allows reaching exactly the maximum board size', () => {
    // 14 numbers: 4 finish row 1, 10 need two more rows → 4 rows in total.
    const board = makeBoard('123456789', '12345');
    expect(addNumbers(board, 4 * COLS)).not.toBeNull();
  });

  it('needs no new row at all when the tail has room', () => {
    expect(canAddNumbers(makeBoard('1.2'), COLS)).toBe(true);
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
    // A full 3-wide row of 1,2,3: no pair, no room left on the row, and a
    // second row would exceed the limit.
    expect(getStatus(makeBoard('###123###'), COLS)).toBe('gameOver');
  });
});
