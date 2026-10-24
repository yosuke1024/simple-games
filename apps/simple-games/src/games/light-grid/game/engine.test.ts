import { describe, expect, it } from 'vitest';
import {
  createSession,
  isSolved,
  move,
  neighbours,
  opening,
  SIZES,
  solution,
  toggle,
  undo,
} from './index';
describe('Light Grid rules and constructive generation', () => {
  it('toggles self and orthogonal cells without wrapping at an edge', () => {
    expect(neighbours(3, 2)).toEqual([5, 1]);
    expect(toggle(Array<number>(9).fill(0), 3, 2)).toEqual([0, 1, 1, 0, 0, 1, 0, 0, 0]);
    const board = opening(5, 42);
    expect(toggle(toggle(board, 5, 12), 5, 12)).toEqual(board);
  });
  it.each(SIZES)('constructs and exactly solves 500 nonempty %s × %s seeded boards', (size) => {
    for (let seed = 0; seed < 500; seed++) {
      let board = opening(size, seed);
      expect(board).toEqual(opening(size, seed));
      expect(isSolved(board)).toBe(false);
      const path = solution(board, size);
      expect(path).not.toBeNull();
      for (const action of path!) board = toggle(board, size, action);
      expect(isSolved(board)).toBe(true);
    }
  });
  it('rejects invalid moves, preserves inputs, and undoes a finished game', () => {
    const initial = createSession(3, 12);
    expect(move(initial, -1)).toBeNull();
    expect(move(initial, 9)).toBeNull();
    expect(move(initial, 0.5)).toBeNull();
    expect(undo(initial)).toBeNull();
    let session = initial;
    for (const action of solution(initial.board, 3)!) session = move(session, action)!;
    expect(session.status).toBe('over');
    expect(move(session, 0)).toBeNull();
    expect(initial.history).toEqual([]);
    while (session.history.length) session = undo(session)!;
    expect(session.board).toEqual(initial.board);
    expect(session.cleared).toBe(true);
    expect(session.status).toBe('playing');
  });
  it('reports inconsistent boards honestly', () => {
    const impossible = Array<number>(16).fill(0);
    impossible[0] = 1;
    expect(solution(impossible, 4)).toBeNull();
    expect(solution([2], 3)).toBeNull();
  });
});
