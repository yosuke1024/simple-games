import { describe, expect, it } from 'vitest';
import { availableColours, createSession, move, opening, region, SIZES, undo } from './index';
describe('Color Flood region rules', () => {
  it('absorbs orthogonal chains, never diagonal-only squares', () => {
    const board = [0, 1, 2, 1, 2, 2, 2, 2, 0];
    expect(region(board, 3)).toEqual([0]);
    expect(availableColours(board, 3)).toEqual([1]);
    expect(region([1, 1, 2, 1, 2, 2, 2, 2, 0], 3).sort()).toEqual([0, 1, 3]);
  });
  it.each(SIZES)(
    'every move grows a %s board and every seed can finish without a move allowance',
    (size) => {
      for (let seed = 0; seed < 80; seed++) {
        let session = createSession(size, seed);
        expect(session.board).toEqual(opening(size, seed));
        while (session.status === 'playing') {
          const before = region(session.board, size).length;
          const choices = availableColours(session.board, size);
          expect(choices.length).toBeGreaterThan(0);
          session = move(session, choices[seed % choices.length]!)!;
          expect(region(session.board, size).length).toBeGreaterThan(before);
          expect(session.history.length).toBeLessThan(size * size);
        }
        expect(region(session.board, size)).toHaveLength(size * size);
      }
    },
  );
  it('ignores same/nonadjacent/invalid colours and fully undoes a clear', () => {
    let session = createSession(6, 0);
    const initial = session;
    expect(move(session, session.board[0]!)).toBeNull();
    expect(move(session, 6)).toBeNull();
    expect(move(session, NaN)).toBeNull();
    expect(undo(session)).toBeNull();
    while (session.status === 'playing')
      session = move(session, availableColours(session.board, 6)[0]!)!;
    expect(move(session, 0)).toBeNull();
    while (session.history.length) session = undo(session)!;
    expect(session.board).toEqual(initial.board);
    expect(session.status).toBe('playing');
    expect(session.cleared).toBe(true);
    expect(initial.history).toEqual([]);
  });
});
