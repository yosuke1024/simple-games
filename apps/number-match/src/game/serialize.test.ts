import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard } from './serialize';
import { makeBoard } from './test-helpers';

describe('board serialization', () => {
  it('round-trips a board, holes included', () => {
    const board = makeBoard('19.4567.8', '123');
    const decoded = decodeBoard(encodeBoard(board));
    expect(decoded).toEqual(board);
  });

  it('round-trips an explicitly shaped board', () => {
    const board = makeBoard('##123##', '123456789');
    expect(decodeBoard(encodeBoard(board))).toEqual(board);
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
    // '0' marks a hole, which must not also be flagged cleared.
    expect(decodeBoard({ values: '103', mask: '010' })).toBeNull();
    expect(decodeBoard({ values: '123', mask: '002' })).toBeNull();
    expect(decodeBoard({ values: 123, mask: '000' })).toBeNull();
  });
});
