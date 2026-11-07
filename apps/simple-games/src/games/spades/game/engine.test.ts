import { describe, it, expect } from 'vitest';
import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  restore,
  legalCards,
  trickWinner,
  scoreHand,
} from './index';
describe('Spades', () => {
  it('follows suit, breaks spades and ranks aces high', () => {
    expect(legalCards([0, 13, 27], [], false)).toEqual([13, 27]);
    expect(legalCards([0, 12], [], false)).toEqual([0, 12]);
    expect(legalCards([0, 13, 27], [{ seat: 1, card: 14 }], true)).toEqual([13]);
    expect(
      trickWinner([
        { seat: 1, card: 25 },
        { seat: 2, card: 13 },
        { seat: 3, card: 5 },
        { seat: 0, card: 38 },
      ]),
    ).toBe(3);
  });
  it('separates nil from the partnership contract and carries bags', () => {
    expect(scoreHand([3, 3, 3, 3], [4, 3, 3, 3], [9, 0])).toEqual({
      bids: [3, 3, 3, 3],
      tricks: [4, 3, 3, 3],
      delta: [-39, 60],
      bags: [0, 0],
    });
    const fail = scoreHand([0, 3, 4, 3], [1, 4, 3, 5], [0, 0]);
    expect(fail.delta[0]).toBe(-139);
    expect(fail.bags[0]).toBe(1);
    expect(scoreHand([0, 3, 4, 3], [0, 4, 4, 5], [0, 0]).delta[0]).toBe(140);
  });
  it('finishes matches using legal bids and plays and resumes at hand boundaries', () => {
    for (let seed = 0; seed < 8; seed++) {
      let s = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 15000) {
        expect(restore(s), `seed ${seed}, move ${moves}`).toEqual(s);
        const n = step(s, chooseCpuMove(cpuView(s)));
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(200);
      expect(s.winners).toHaveLength(2);
    }
  });
  it('rejects malformed scores and play before bidding', () => {
    const s = createSession(9);
    expect(step(s, { kind: 'play', card: s.hands[0]![0]! })).toBeNull();
    expect(step(s, { kind: 'bid', bid: 14 })).toBeNull();
    expect(restore({ ...s, bags: [10, 0] })).toBeNull();
  });
});
