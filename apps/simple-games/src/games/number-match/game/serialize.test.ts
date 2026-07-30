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

  it('round-trips stones and wilds, cleared wilds included', () => {
    const board = makeBoard('1S*4', '*S789');
    // 's' stone, 'w' wild, '0' hole — each row padded out to nine slots.
    expect(encodeBoard(board).values).toBe('1sw400000ws7890000');
    expect(decodeBoard(encodeBoard(board))).toEqual(board);
    // A wild keeps its kind after being cleared, so that has to survive too.
    const withClearedWild = [...board, { kind: 'wild' as const, cleared: true }];
    expect(decodeBoard(encodeBoard(withClearedWild))).toEqual(withClearedWild);
  });

  it('rejects a stone that claims to be cleared', () => {
    // Stones are never cleared, so this can only be corruption.
    expect(decodeBoard({ values: '1s3', mask: '010' })).toBeNull();
    expect(decodeBoard({ values: '1s3', mask: '000' })).not.toBeNull();
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
