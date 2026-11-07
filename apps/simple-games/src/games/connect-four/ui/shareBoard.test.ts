import { describe, expect, it } from 'vitest';
import { seriesColors } from '@simple-games/brand';
import { titleAccentOf } from '@/app/titleAccent';
import { createSession, type ConnectFourSession } from '../game/session';
import { CPU, PLAYER, type Piece } from '../game/types';
import { shareBoardOf } from './shareBoard';

function finalSession(status: 'won' | 'lost' = 'won'): ConnectFourSession {
  const board: Piece[] = Array<Piece>(42).fill(0);
  // A horizontal finish at the bottom, with the opponent immediately above.
  board[28] = CPU;
  board[29] = CPU;
  board[30] = CPU;
  board[35] = PLAYER;
  board[36] = PLAYER;
  board[37] = PLAYER;
  board[38] = PLAYER;
  return {
    ...createSession('normal', status === 'lost' ? CPU : PLAYER, 'private-seed'),
    board:
      status === 'lost'
        ? board.map((piece) => (piece === 0 ? 0 : piece === PLAYER ? CPU : PLAYER))
        : board,
    status,
    winningLine: [35, 36, 37, 38],
    history: [{ board: Array<Piece>(42).fill(0), moveCount: 0 }],
    moveCount: 7,
    elapsedSeconds: 93,
  };
}

describe('Connect Four share board', () => {
  it('preserves the full 7 by 6 final position, player colour and winning row', () => {
    const preview = shareBoardOf(finalSession());
    expect(preview).toMatchObject({ gameId: 'connect-four', columns: 7, rows: 6 });
    expect(preview?.cells).toHaveLength(42);
    expect(preview?.cells[0]).toEqual({ fill: seriesColors.paper, shape: 'circle' });
    expect(preview?.cells[28]).toMatchObject({ piece: 'accent', ink: '#1f6f6b', marked: false });
    expect(preview?.cells[35]).toMatchObject({
      piece: 'accent',
      ink: titleAccentOf('connect-four').light,
      marked: true,
    });
    expect(preview?.cells.filter((cell) => cell.marked)).toHaveLength(4);
    expect(preview?.cells.filter((cell) => cell.piece)).toHaveLength(7);
  });

  it('keeps the CPU-winning row teal when the player loses', () => {
    const preview = shareBoardOf(finalSession('lost'));
    expect(preview?.cells[35]).toMatchObject({ piece: 'accent', ink: '#1f6f6b', marked: true });
    expect(preview?.cells[28]?.ink).toBe(titleAccentOf('connect-four').light);
  });

  it('omits the private seed, history, elapsed time and unfinished games', () => {
    expect(shareBoardOf(createSession('easy'))).toBeNull();
    const session = finalSession();
    const before = JSON.stringify(session);
    const preview = JSON.stringify(shareBoardOf(session));
    expect(preview).not.toMatch(/private-seed|history|elapsedSeconds|moveCount|difficulty/);
    expect(JSON.stringify(session)).toBe(before);
  });
});
