import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard } from './serialize';
import { makeBoard } from './test-helpers';

describe('board serialization', () => {
  it('round-trips a board', () => {
    const board = makeBoard('19.4567.8', '123');
    const decoded = decodeBoard(encodeBoard(board));
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(board.length);
    decoded!.forEach((cell, i) => {
      expect(cell.cleared).toBe(board[i]!.cleared);
      if (!cell.cleared) expect(cell.value).toBe(board[i]!.value);
    });
  });

  it('round-trips an empty board', () => {
    expect(decodeBoard(encodeBoard([]))).toEqual([]);
  });

  it('rejects malformed input without throwing', () => {
    expect(decodeBoard(null)).toBeNull();
    expect(decodeBoard(undefined)).toBeNull();
    expect(decodeBoard('junk')).toBeNull();
    expect(decodeBoard({})).toBeNull();
    expect(decodeBoard({ values: '123', mask: '00' })).toBeNull();
    expect(decodeBoard({ values: '1x3', mask: '000' })).toBeNull();
    expect(decodeBoard({ values: '103', mask: '000' })).toBeNull();
    expect(decodeBoard({ values: '123', mask: '002' })).toBeNull();
    expect(decodeBoard({ values: 123, mask: '000' })).toBeNull();
  });
});
