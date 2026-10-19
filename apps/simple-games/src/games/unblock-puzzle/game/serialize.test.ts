/**
 * The fail-closed formats of docs/UNBLOCK_PUZZLE_RULES.md §12: a board
 * survives only as a legal board in canonical order, and a move list only as
 * moves play could have made from that board.
 */
import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard, encodeMoves, replayMoves } from './serialize';
import { TARGET_BLOCK, type Board } from './types';

/**
 *   . . . . . .
 *   . . . . . .
 *   a a . b . .
 *   . . . b . .
 *   . . . . . .
 *   c c c . . .
 */
const TEXT = '......' + '......' + 'aa.b..' + '...b..' + '......' + 'ccc...';
const BOARD: Board = {
  blocks: [
    TARGET_BLOCK,
    { orientation: 'v', length: 2, lane: 3 },
    { orientation: 'h', length: 3, lane: 5 },
  ],
  positions: [0, 2, 0],
};

describe('boards', () => {
  it('writes and reads back one character per cell', () => {
    expect(encodeBoard(BOARD)).toBe(TEXT);
    expect(decodeBoard(TEXT)).toEqual(BOARD);
  });

  it('reads orientation and length off the cells', () => {
    const board = decodeBoard('b.....' + 'b.....' + 'b.aa..' + '......' + '......' + '....cc')!;
    expect(board.blocks).toEqual([
      TARGET_BLOCK,
      { orientation: 'v', length: 3, lane: 0 },
      { orientation: 'h', length: 2, lane: 5 },
    ]);
    expect(board.positions).toEqual([2, 0, 4]);
  });

  it('drops text that is not a board', () => {
    expect(decodeBoard(TEXT.slice(1))).toBeNull();
    expect(decodeBoard(TEXT + '.')).toBeNull();
    expect(decodeBoard(42)).toBeNull();
    expect(decodeBoard(null)).toBeNull();
    // An unknown character, and a letter past the sixteenth block.
    expect(decodeBoard(TEXT.replace('c', 'C'))).toBeNull();
    expect(decodeBoard(TEXT.replace('ccc', 'qqq'))).toBeNull();
    // No target at all.
    expect(decodeBoard('.'.repeat(36))).toBeNull();
  });

  it('drops blocks that are not one straight run of two or three', () => {
    // One cell; four cells; a bent pair; two separate pairs under one letter.
    expect(decodeBoard(TEXT.replace('ccc...', 'c.....'))).toBeNull();
    expect(decodeBoard(TEXT.replace('ccc...', 'cccc..'))).toBeNull();
    expect(decodeBoard(TEXT.replace('...b..', '..b...'))).toBeNull();
    expect(decodeBoard(TEXT.replace('ccc...', 'cc.cc.'))).toBeNull();
    // A horizontal run that wraps from one row into the next.
    expect(decodeBoard('.....b' + 'b.....' + 'aa....' + '......' + '......' + '......')).toBeNull();
  });

  it('drops a letter gap, a non-canonical order, and the rules of §1', () => {
    // `b` missing while `c` exists.
    expect(decodeBoard(TEXT.replace(/b/g, '.'))).toBeNull();
    // `b` and `c` swapped: c's first cell would come before b's.
    expect(decodeBoard(TEXT.replace(/b/g, 'x').replace(/c/g, 'b').replace(/x/g, 'c'))).toBeNull();
    // The target as a vertical pair, and on the wrong row.
    expect(decodeBoard('a.....' + 'a.....' + '......' + '......' + '......' + '......')).toBeNull();
    expect(decodeBoard('......' + 'aa....' + '......' + '......' + '......' + '......')).toBeNull();
    // Another horizontal block in the target's row.
    expect(decodeBoard('......' + '......' + 'aa.bb.' + '......' + '......' + '......')).toBeNull();
  });
});

describe('move lists', () => {
  it('writes two characters per move and replays them through the rules', () => {
    const moves = [
      { block: 2, to: 3 },
      { block: 1, to: 0 },
      { block: 0, to: 4 },
    ];
    const text = encodeMoves(moves);
    expect(text).toBe('c3b0a4');
    const replayed = replayMoves(text, BOARD, 100)!;
    expect(replayed.moves).toEqual([
      { block: 2, from: 0, to: 3 },
      { block: 1, from: 2, to: 0 },
      { block: 0, from: 0, to: 4 },
    ]);
    expect(replayed.board.positions).toEqual([4, 0, 3]);
    expect(replayMoves('', BOARD, 100)).toEqual({ moves: [], board: BOARD });
  });

  it('drops a slide the rules refuse', () => {
    // The target through b; b off the board; b to where it already is.
    expect(replayMoves('a4', BOARD, 100)).toBeNull();
    expect(replayMoves('b5', BOARD, 100)).toBeNull();
    expect(replayMoves('b2', BOARD, 100)).toBeNull();
    // A block that does not exist, and characters that are not a move.
    expect(replayMoves('d0', BOARD, 100)).toBeNull();
    expect(replayMoves('b-', BOARD, 100)).toBeNull();
    expect(replayMoves('B0', BOARD, 100)).toBeNull();
    expect(replayMoves('b', BOARD, 100)).toBeNull();
    expect(replayMoves(7, BOARD, 100)).toBeNull();
  });

  it('drops two moves of one block in a row — play merges them (§4)', () => {
    expect(replayMoves('b0', BOARD, 100)).not.toBeNull();
    expect(replayMoves('b1b0', BOARD, 100)).toBeNull();
    expect(replayMoves('b1c2b0', BOARD, 100)).not.toBeNull();
  });

  it('drops a move after the exit was reached, and a list past the limit', () => {
    expect(replayMoves('b0a4', BOARD, 100)).not.toBeNull();
    expect(replayMoves('b0a4c1', BOARD, 100)).toBeNull();
    expect(replayMoves('c1b0c2', BOARD, 2)).toBeNull();
    expect(replayMoves('c1b0', BOARD, 2)).not.toBeNull();
  });
});
