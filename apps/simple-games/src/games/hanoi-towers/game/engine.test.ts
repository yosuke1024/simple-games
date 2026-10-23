import { describe, expect, it } from 'vitest';
import { applyAction, createSession, encodeMove, move, SIZES, topDisk, undo } from './index';
function plan(count: number, from = 0, to = 2, via = 1): number[] {
  return count === 0
    ? []
    : [...plan(count - 1, from, via, to), encodeMove(from, to), ...plan(count - 1, via, to, from)];
}
describe('Hanoi rules', () => {
  it.each(SIZES)('solves %i disks in 2^n−1 moves and undoes every move exactly', (size) => {
    let session = createSession(size, 0);
    const original = session;
    const states = [session];
    for (const action of plan(size)) {
      session = move(session, action)!;
      expect(session).not.toBeNull();
      states.push(session);
    }
    expect(session.status).toBe('over');
    expect(session.history).toHaveLength(2 ** size - 1);
    expect(move(session, 1)).toBeNull();
    for (let i = states.length - 2; i >= 0; i--) {
      session = undo(session)!;
      expect(session.board).toEqual(states[i]!.board);
      expect(session.history).toEqual(states[i]!.history);
      expect(session.cleared).toBe(true);
    }
    expect(undo(session)).toBeNull();
    expect(original.board).toEqual(Array(size).fill(0));
  });
  it('rejects larger-over-smaller, empty sources and malformed actions without mutating', () => {
    const session = move(createSession(3, 7), encodeMove(0, 1))!;
    expect(topDisk(session.board, 0)).toBe(1);
    expect(topDisk(session.board, 1)).toBe(0);
    for (const action of [encodeMove(0, 1), encodeMove(2, 0), 0, -1, 9, NaN, 0.5])
      expect(move(session, action)).toBeNull();
    expect(session.board).toEqual([1, 0, 0]);
  });
  it('every legal action on all 243 five-disk arrangements has an exact legal inverse', () => {
    for (let state = 0; state < 3 ** 5; state++) {
      const board = Array.from({ length: 5 }, (_, i) => Math.floor(state / 3 ** i) % 3);
      for (let from = 0; from < 3; from++)
        for (let to = 0; to < 3; to++) {
          const next = applyAction(board, encodeMove(from, to));
          if (next) expect(applyAction(next, encodeMove(to, from))).toEqual(board);
        }
    }
  });
});
