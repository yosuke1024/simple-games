import { describe, expect, it } from 'vitest';
import {
  adjacent,
  createSession,
  destinations,
  DIRECTIONS,
  move,
  SIZES,
  solution,
  undo,
} from './index';
describe('perfect maze generation', () => {
  it.each(SIZES)(
    'generates connected trees with reciprocal passages for 150 seeds at size %i',
    (size) => {
      for (let seed = 0; seed < 150; seed++) {
        const session = createSession(size, seed);
        expect(createSession(size, seed)).toEqual(session);
        let edges = 0;
        let reciprocal = true;
        let bounded = true;
        const reached = new Set([0]),
          queue = [0];
        for (let head = 0; head < queue.length; head++) {
          const current = queue[head]!;
          for (const next of destinations(session.board, size, current)) {
            edges++;
            reciprocal &&= destinations(session.board, size, next).includes(current);
            if (!reached.has(next)) {
              reached.add(next);
              queue.push(next);
            }
          }
        }
        expect(reached.size).toBe(size * size);
        expect(edges / 2).toBe(size * size - 1);
        expect(reciprocal).toBe(true);
        for (let cell = 0; cell < session.board.length; cell++)
          for (let d = 0; d < 4; d++) {
            if (session.board[cell]! & (1 << d))
              bounded &&= adjacent(size, cell, DIRECTIONS[d]!) !== null;
          }
        expect(bounded).toBe(true);
      }
    },
  );
  it.each(SIZES)(
    'hints lead to the goal from arbitrary detours and undo restores the exact path at size %i',
    (size) => {
      for (let seed = 0; seed < 30; seed++) {
        let session = createSession(size, seed);
        const start = session;
        for (let i = 0; i < 20 && session.status === 'playing'; i++) {
          const next = destinations(session.board, size, session.position)[
            i % destinations(session.board, size, session.position).length
          ]!;
          session = move(session, next)!;
        }
        while (session.status === 'playing') {
          const path = solution(session);
          expect(path.length).toBeLessThan(size * size);
          session = move(session, path[0]!)!;
        }
        expect(session.position).toBe(size * size - 1);
        expect(move(session, 0)).toBeNull();
        while (session.history.length) session = undo(session)!;
        expect(session.position).toBe(0);
        expect(session.board).toEqual(start.board);
        expect(session.cleared).toBe(true);
      }
    },
  );
  it('rejects walls, stationary moves and out-of-range movement', () => {
    const session = createSession(5, 42);
    expect(move(session, 0)).toBeNull();
    expect(move(session, -1)).toBeNull();
    expect(move(session, 24)).toBeNull();
    expect(adjacent(5, 0, 'left')).toBeNull();
    expect(adjacent(5, 0, 'up')).toBeNull();
  });
});
