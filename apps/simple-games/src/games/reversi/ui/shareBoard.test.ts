import { describe, expect, it } from 'vitest';
import { BLACK, EMPTY, WHITE, createSession, restoreSession, type Piece } from '../game';
import { shareBoardOf } from './shareBoard';

describe('Reversi share board', () => {
  it('preserves actual colours when the player is white and the terminal board has an empty square', () => {
    // Neither colour can capture at the one empty square beside the corner.
    const board = new Array<Piece>(64).fill(BLACK);
    board[0] = WHITE;
    board[1] = EMPTY;
    const session = restoreSession({
      ...createSession('easy', WHITE, 'private-reversi-seed'),
      board: Object.freeze(board),
      moveCount: 59,
    });
    expect(session.status).toBe('lost');

    const preview = shareBoardOf(session)!;
    expect(preview.gameId).toBe('reversi');
    expect([preview.columns, preview.rows]).toEqual([8, 8]);
    expect(preview.cells.map((cell) => cell.piece)).toEqual([
      'light',
      undefined,
      ...new Array<string>(62).fill('dark'),
    ]);
    expect(preview.cells[0]?.ink).not.toBe(preview.cells[2]?.ink);
    expect(JSON.stringify(preview)).not.toContain(session.seed);
  });

  it('does not export the position of an unfinished match', () => {
    expect(shareBoardOf(createSession('normal', BLACK, 'still-playing'))).toBeNull();
  });
});
