import { describe, expect, it } from 'vitest';
import {
  act,
  capacity,
  chooseCpuMove,
  createSession,
  legalMoves,
  undo,
  type Session,
} from './index';
describe('Chain Territory rules', () => {
  it('uses 2/3/4 neighbor capacities and alternates legal turns', () => {
    expect([capacity(0), capacity(1), capacity(6)]).toEqual([2, 3, 4]);
    const first = act(createSession('normal', 0), 0)!;
    expect(first.status).toBe('playing');
    expect(act(first, 0)).toBeNull();
    expect(first.turn).toBe(2);
    expect(act(first, 1)!.status).toBe('playing');
  });
  it('captures neighbors, conserves orbs and stops on elimination', () => {
    let s = createSession('normal', 1);
    s = act(s, 0)!;
    s = act(s, 1)!;
    s = act(s, 0)!;
    expect(s.status).toBe('won');
    expect(s.board[1]).toEqual({ owner: 1, count: 2 });
    expect(s.board[5]).toEqual({ owner: 1, count: 1 });
    expect(s.board.reduce((sum, c) => sum + c.count, 0)).toBe(3);
    expect(act(s, 3)).toBeNull();
  });
  it('plays many complete legal matches without a repeating cascade', () => {
    for (let seed = 0; seed < 120; seed++) {
      let s = createSession(seed % 2 ? 'normal' : 'hard', seed);
      while (s.status === 'playing') {
        const moves = legalMoves(s);
        const move =
          s.turn === 2
            ? chooseCpuMove(s)!
            : moves[(seed * 17 + s.actions.length * 7) % moves.length]!;
        const next: Session = act(s, move)!;
        expect(next.board.reduce((sum, c) => sum + c.count, 0)).toBe(next.actions.length);
        expect(next.actions.length).toBeLessThanOrEqual(69);
        s = next;
      }
    }
  });
  it('undo restores the player decision before the CPU reply', () => {
    const initial = createSession('hard', 4);
    const first = act(initial, 14)!;
    const reply = act(first, chooseCpuMove(first)!)!;
    expect(undo(reply)?.board).toEqual(initial.board);
    expect(undo(first)?.actions).toEqual([]);
    expect(chooseCpuMove(first)).toBe(chooseCpuMove(first));
  });
});
