import { describe, expect, it } from 'vitest';
import { canConnect, isMatchingValues, isValidPair } from './rules';
import { makeBoard } from './test-helpers';

describe('isMatchingValues', () => {
  it('accepts same digits', () => {
    expect(isMatchingValues(3, 3)).toBe(true);
    expect(isMatchingValues(7, 7)).toBe(true);
    expect(isMatchingValues(5, 5)).toBe(true);
  });

  it('accepts pairs summing to 10', () => {
    expect(isMatchingValues(1, 9)).toBe(true);
    expect(isMatchingValues(2, 8)).toBe(true);
    expect(isMatchingValues(4, 6)).toBe(true);
    expect(isMatchingValues(6, 4)).toBe(true);
  });

  it('rejects other combinations', () => {
    expect(isMatchingValues(3, 4)).toBe(false);
    expect(isMatchingValues(1, 2)).toBe(false);
    expect(isMatchingValues(9, 2)).toBe(false);
  });
});

describe('canConnect — horizontal (reading order within a row)', () => {
  it('connects adjacent cells in a row', () => {
    const board = makeBoard('19555');
    expect(canConnect(board, 0, 1)).toBe(true);
  });

  it('connects across cleared cells in a row', () => {
    const board = makeBoard('1..95');
    expect(canConnect(board, 0, 3)).toBe(true);
  });

  it('rejects when a live cell is between', () => {
    const board = makeBoard('129');
    expect(canConnect(board, 0, 2)).toBe(false);
  });
});

describe('canConnect — vertical', () => {
  it('connects vertically adjacent cells in the same column', () => {
    const board = makeBoard('155555555', '122222222');
    expect(canConnect(board, 0, 9)).toBe(true);
  });

  it('connects vertically across a cleared cell in the same column', () => {
    const board = makeBoard('155555555', '.22222222', '133333333');
    expect(canConnect(board, 0, 18)).toBe(true);
  });

  it('rejects vertically when a live cell is between', () => {
    const board = makeBoard('155555555', '222222222', '133333333');
    expect(canConnect(board, 0, 18)).toBe(false);
  });
});

describe('canConnect — diagonal', () => {
  it('connects diagonally adjacent cells (down-right)', () => {
    const board = makeBoard('255555555', '582222222');
    expect(canConnect(board, 0, 10)).toBe(true);
  });

  it('connects diagonally adjacent cells (down-left)', () => {
    const board = makeBoard('552555555', '585555555');
    expect(canConnect(board, 2, 10)).toBe(true);
  });

  it('connects diagonally across a cleared diagonal cell', () => {
    const board = makeBoard('255555555', '5.5555555', '558555555');
    expect(canConnect(board, 0, 20)).toBe(true);
  });

  it('rejects diagonally when a live cell is between', () => {
    const board = makeBoard('255555555', '535555555', '558555555');
    expect(canConnect(board, 0, 20)).toBe(false);
  });
});

describe('canConnect — row end to next row start (reading order wrap)', () => {
  it('connects the last cell of a row with the first cell of the next row', () => {
    const board = makeBoard('555555551', '955555555');
    expect(canConnect(board, 8, 9)).toBe(true);
  });

  it('connects across cleared cells spanning the row boundary', () => {
    const board = makeBoard('55555551.', '.95555555');
    expect(canConnect(board, 7, 10)).toBe(true);
  });

  it('rejects when a live cell sits between across the boundary', () => {
    const board = makeBoard('555555512', '955555555');
    // index 7 (1) and index 9 (9): index 8 (2) is live between them.
    expect(canConnect(board, 7, 9)).toBe(false);
  });
});

describe('canConnect — misc', () => {
  it('rejects the same cell', () => {
    const board = makeBoard('19');
    expect(canConnect(board, 0, 0)).toBe(false);
  });

  it('rejects out-of-range indices', () => {
    const board = makeBoard('19');
    expect(canConnect(board, 0, 5)).toBe(false);
    expect(canConnect(board, -1, 1)).toBe(false);
  });
});

describe('isValidPair', () => {
  it('requires both cells to be live', () => {
    const board = makeBoard('1.9');
    expect(isValidPair(board, 0, 1)).toBe(false);
    expect(isValidPair(board, 0, 2)).toBe(true);
  });

  it('requires matching values and a connection', () => {
    // 1 and 9 match but are blocked; 1 and 2 connect but do not match.
    const board = makeBoard('129');
    expect(isValidPair(board, 0, 2)).toBe(false);
    expect(isValidPair(board, 0, 1)).toBe(false);
  });
});
