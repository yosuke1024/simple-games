/**
 * The session (docs/BLOCK_PUZZLE_RULES.md §1, §2, §3, §7).
 *
 * The undo test is the one that matters most: it puts a placement back and
 * then makes the same placement again, and expects the identical game. That
 * is the whole promise of §7 — undo is a step back, never a reroll — and it
 * only holds because the refill is a pure function of (seed, batchIndex).
 */
import { describe, expect, it } from 'vitest';
import { canPlace } from './engine';
import { drawBatch, pieceById } from './pieces';
import {
  canUndo,
  createSession,
  placePiece,
  restoreSession,
  UNDO_HISTORY_LIMIT,
  undo,
  type BlockSession,
} from './session';
import { BOARD_SIZE, emptyBoard, indexAt, TRAY_SIZE, type Board, type Tray } from './types';

const SEED = 'block-session-test';

/** Catalogue entries the tests lean on: the single square and the 2×2. */
const SINGLE = 0;
const SQUARE_2X2 = 9;
const BLOCK_3X3 = 10;

/** A board from a picture: '#' filled, anything else empty. */
const boardFrom = (rows: readonly string[]): Board =>
  rows
    .join('')
    .split('')
    .map((character) => character === '#');

/** A game in progress on a board and tray of the test's choosing. */
const gameOn = (board: Board, tray: Tray): BlockSession =>
  restoreSession({
    seed: SEED,
    board,
    tray,
    score: 0,
    batchIndex: 0,
    linesCleared: 0,
    elapsedSeconds: 0,
  });

/** The first spot a slot's piece fits, scanning row-major. */
function firstFit(session: BlockSession, slot: number): { row: number; col: number } {
  const piece = pieceById(session.tray[slot])!;
  for (let row = 0; row <= BOARD_SIZE - piece.height; row++) {
    for (let col = 0; col <= BOARD_SIZE - piece.width; col++) {
      if (canPlace(session.board, piece, row, col)) return { row, col };
    }
  }
  throw new Error(`piece ${piece.id} fits nowhere`);
}

describe('a fresh game', () => {
  it('starts empty, holding the first batch of the seed (§1, §6)', () => {
    const session = createSession(SEED);
    expect(session.board.filter(Boolean)).toHaveLength(0);
    expect(session.tray).toEqual(drawBatch(SEED, 0));
    expect(session.batchIndex).toBe(0);
    expect(session.score).toBe(0);
    expect(session.status).toBe('playing');
    expect(canUndo(session)).toBe(false);
  });
});

describe('placing (§3)', () => {
  it('returns null for a placement the rules do not allow', () => {
    const session = createSession(SEED);
    expect(placePiece(session, 0, -1, 0)).toBeNull();
    expect(placePiece(session, 0, 0, 99)).toBeNull();
    expect(placePiece(session, TRAY_SIZE, 0, 0)).toBeNull();
    expect(placePiece(session, -1, 0, 0)).toBeNull();
  });

  it('returns null for a slot already spent, and for a game already over', () => {
    const spent = gameOn(emptyBoard(), [null, SINGLE, SINGLE]);
    expect(placePiece(spent, 0, 0, 0)).toBeNull();

    const over = { ...spent, status: 'over' as const };
    expect(placePiece(over, 1, 0, 0)).toBeNull();
  });

  it('returns null over a filled cell, leaving the board untouched', () => {
    const board = [...emptyBoard()];
    board[indexAt(3, 3)] = true;
    const session = gameOn(board, [SINGLE, SINGLE, SINGLE]);
    expect(placePiece(session, 0, 3, 3)).toBeNull();
    expect(session.board[indexAt(3, 3)]).toBe(true);
    expect(session.board.filter(Boolean)).toHaveLength(1);
  });

  it('scores the squares it put down (§5)', () => {
    const session = gameOn(emptyBoard(), [BLOCK_3X3, SINGLE, SINGLE]);
    const next = placePiece(session, 0, 0, 0)!;
    expect(next.score).toBe(9);
    expect(next.linesCleared).toBe(0);
    expect(next.placements).toBe(1);
    expect(next.tray[0]).toBeNull();
  });

  it('clears the line it completes and counts it (§4, §5)', () => {
    const board = boardFrom([
      '.#######',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const session = gameOn(board, [SINGLE, SINGLE, SINGLE]);
    const next = placePiece(session, 0, 0, 0)!;
    expect(next.linesCleared).toBe(1);
    expect(next.board.filter(Boolean)).toHaveLength(0);
    expect(next.score).toBe(1 + 10);
  });
});

describe('the tray (§1)', () => {
  it('refills only once all three slots are spent', () => {
    let session = gameOn(emptyBoard(), [SINGLE, SINGLE, SINGLE]);
    session = placePiece(session, 0, 0, 0)!;
    expect(session.batchIndex).toBe(0);
    expect(session.tray).toEqual([null, SINGLE, SINGLE]);

    session = placePiece(session, 1, 2, 0)!;
    expect(session.batchIndex).toBe(0);
    expect(session.tray).toEqual([null, null, SINGLE]);

    session = placePiece(session, 2, 4, 0)!;
    expect(session.batchIndex).toBe(1);
    expect(session.tray).toEqual(drawBatch(SEED, 1));
  });
});

describe('undo (§7)', () => {
  it('puts the board, the tray, the score and the lines back', () => {
    const board = boardFrom([
      '.#######',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
    ]);
    const before = gameOn(board, [SINGLE, SINGLE, SINGLE]);
    const after = placePiece(before, 0, 0, 0)!;
    const back = undo(after)!;

    expect(back.board).toEqual(before.board);
    expect(back.tray).toEqual(before.tray);
    expect(back.score).toBe(before.score);
    expect(back.linesCleared).toBe(before.linesCleared);
    expect(back.placements).toBe(before.placements);
    expect(back.status).toBe('playing');
    expect(canUndo(back)).toBe(false);
  });

  it('restores batchIndex, so the same refill comes back', () => {
    let session = createSession(SEED);
    const first = firstFit(session, 0);
    session = placePiece(session, 0, first.row, first.col)!;
    const second = firstFit(session, 1);
    session = placePiece(session, 1, second.row, second.col)!;

    const beforeLast = session;
    // The third placement empties the tray and pulls the next batch.
    const third = firstFit(session, 2);
    const refilled = placePiece(session, 2, third.row, third.col)!;
    expect(refilled.batchIndex).toBe(1);
    expect(refilled.tray).toEqual(drawBatch(SEED, 1));

    const back = undo(refilled)!;
    expect(back.batchIndex).toBe(beforeLast.batchIndex);
    expect(back.tray).toEqual(beforeLast.tray);

    // Replaying the same placement gives the identical game — undo is a step
    // back, never a reroll.
    const again = placePiece(back, 2, third.row, third.col)!;
    expect(again.tray).toEqual(refilled.tray);
    expect(again.board).toEqual(refilled.board);
    expect(again.score).toBe(refilled.score);
  });

  it('returns null when there is nothing to take back', () => {
    expect(undo(createSession(SEED))).toBeNull();
  });

  it('keeps the history at its cap, dropping the oldest step first', () => {
    // Synthetic: the board and tray are handed back fresh before each step,
    // so the cap can be reached without a real game two thousand moves long.
    let session = gameOn(emptyBoard(), [SINGLE, SINGLE, SINGLE]);
    for (let step = 0; step < UNDO_HISTORY_LIMIT + 5; step++) {
      session = placePiece(
        { ...session, board: emptyBoard(), tray: [SINGLE, SINGLE, SINGLE] },
        0,
        0,
        0,
      )!;
    }
    expect(session.history).toHaveLength(UNDO_HISTORY_LIMIT);
    expect(session.placements).toBe(UNDO_HISTORY_LIMIT + 5);
  });
});

describe('running out of room (§2)', () => {
  /**
   * Rows 0 and column 5 each keep two gaps and every other row and column
   * keeps one, so nothing has cleared — and no two gaps touch, so the only
   * catalogue shape that still fits anywhere is the single square.
   */
  const nearlyFull = boardFrom([
    '.####.##',
    '###.####',
    '######.#',
    '#.######',
    '####.###',
    '#######.',
    '##.#####',
    '#####.##',
  ]);

  it('is already over when the tray it is restored with cannot be placed', () => {
    expect(gameOn(nearlyFull, [SQUARE_2X2, SQUARE_2X2, SQUARE_2X2]).status).toBe('over');
    expect(gameOn(nearlyFull, [SINGLE, SQUARE_2X2, SQUARE_2X2]).status).toBe('playing');
  });

  it('flips to over on the placement that spends the last piece that fitted', () => {
    const session = gameOn(nearlyFull, [SINGLE, SQUARE_2X2, SQUARE_2X2]);
    // (0,5) is the one gap whose row and column both keep another gap, so
    // filling it clears nothing and the board stays as tight as it was.
    const next = placePiece(session, 0, 0, 5)!;
    expect(next.linesCleared).toBe(0);
    expect(next.status).toBe('over');
  });

  it('stays in play while one placeable piece is left', () => {
    const session = gameOn(nearlyFull, [SINGLE, SINGLE, SQUARE_2X2]);
    const next = placePiece(session, 0, 0, 5)!;
    expect(next.status).toBe('playing');
  });
});
