import { describe, expect, it } from 'vitest';
import { createSession, type GomokuSession } from '../game/session';
import { BLACK, WHITE, type Piece } from '../game/types';
import { shareBoardOf } from './shareBoard';

function finalSession(playerColor: typeof BLACK | typeof WHITE = BLACK): GomokuSession {
  const board: Piece[] = Array<Piece>(225).fill(0);
  for (const index of [106, 107, 108, 109, 110]) board[index] = BLACK;
  for (const index of [91, 92, 93, 94]) board[index] = WHITE;
  return {
    ...createSession('hard', playerColor, 'private-seed'),
    board,
    status: playerColor === BLACK ? 'won' : 'lost',
    winningLine: [106, 107, 108, 109, 110],
    moveCount: 9,
    elapsedSeconds: 120,
    history: [{ board: Array<Piece>(225).fill(0), moveCount: 0 }],
  };
}

describe('Gomoku share board', () => {
  it('preserves all 225 intersections and the actual five-stone finish', () => {
    const preview = shareBoardOf(finalSession());
    expect(preview).toMatchObject({
      gameId: 'gomoku',
      columns: 15,
      rows: 15,
      layout: 'intersections',
      background: '#d9b884',
      gridColor: '#9c7d51',
    });
    expect(preview?.cells).toHaveLength(225);
    expect(preview?.cells[0]).toEqual({});
    expect(preview?.cells[106]).toEqual({ piece: 'dark', marked: true });
    expect(preview?.cells[94]).toEqual({ piece: 'light', marked: false });
    expect(preview?.cells.filter((cell) => cell.marked)).toHaveLength(5);
    expect(preview?.cells.filter((cell) => cell.piece)).toHaveLength(9);
  });

  it('does not recolour the stones when the player holds white and loses', () => {
    const preview = shareBoardOf(finalSession(WHITE));
    expect(preview?.cells[106]).toEqual({ piece: 'dark', marked: true });
    expect(preview?.cells[94]).toEqual({ piece: 'light', marked: false });
  });

  it('shares no session history or hidden metadata and leaves the session unchanged', () => {
    const session = finalSession();
    const before = JSON.stringify(session);
    const preview = JSON.stringify(shareBoardOf(session));
    expect(preview).not.toMatch(
      /private-seed|history|elapsedSeconds|moveCount|difficulty|playerColor/,
    );
    expect(JSON.stringify(session)).toBe(before);
    expect(shareBoardOf(createSession('easy'))).toBeNull();
  });
});
