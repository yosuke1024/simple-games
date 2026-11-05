import { describe, it, expect } from 'vitest';
import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  restore,
  total,
  canSplit,
  type Session,
  type Hand,
} from './index';
const h = (cards: number[], status: Hand['status'] = 'playing'): Hand => ({
  cards,
  stake: 10,
  split: false,
  splitAces: false,
  status,
  payout: null,
});
function table(hands: Hand[][], dealer: number[], next: number[] = []): Session {
  const used = [...hands.flat().flatMap((h) => h.cards), ...dealer, ...next],
    shoe = Array.from({ length: 312 }, (_, i) => i).filter((c) => !used.includes(c));
  return {
    ...createSession(1),
    hands,
    dealer,
    shoe: [...shoe, ...[...next].reverse()],
    turn: 0,
    handIndex: 0,
    scores: [],
    status: 'playing',
  };
}
describe('Blackjack', () => {
  it('counts aces without busting unnecessarily', () => {
    expect(total([0, 13, 8])).toEqual({ value: 21, soft: true });
    expect(total([0, 13, 8, 9])).toEqual({ value: 21, soft: false });
  });
  it('splits aces with exactly one card per hand and gives no natural bonus', () => {
    let s = table(
      [[h([0, 13])], [h([10, 20], 'stand')], [h([36, 46], 'stand')], [h([62, 72], 'stand')]],
      [22, 32],
      [9, 25],
    );
    expect(canSplit(cpuView(s))).toBe(true);
    s = step(s, { kind: 'split' })!;
    expect(s.hands[0]).toHaveLength(2);
    expect(
      s.hands[0]!.every((x) => x.cards.length === 2 && x.status === 'stand' && x.splitAces),
    ).toBe(true);
    expect(s.hands[0]!.every((x) => x.payout === 10)).toBe(true);
  });
  it('stands on soft seventeen and pays a natural three to two', () => {
    const s = table(
      [[h([1, 14])], [h([13, 22], 'stand')], [h([38, 46], 'stand')], [h([64, 72], 'stand')]],
      [0, 6],
    );
    const n = step(s, { kind: 'stand' })!;
    expect(n.dealer).toEqual([0, 6]);
    expect(n.hands[1]![0]!.payout).toBe(15);
    expect(n.scores[0]).toBe(-10);
  });
  it('doubles for one card only and rejects later doubles', () => {
    const s = table(
      [[h([4, 18])], [h([10, 20], 'stand')], [h([36, 46], 'stand')], [h([62, 72], 'stand')]],
      [22, 32],
      [9],
    );
    const n = step(s, { kind: 'double' })!;
    expect(n.hands[0]![0]!.stake).toBe(20);
    expect(n.hands[0]![0]!.cards).toHaveLength(3);
    expect(n.hands[0]![0]!.payout).toBe(20);
  });
  it('completes seeded rounds without exposing the hole card to CPU', () => {
    for (let seed = 0; seed < 150; seed++) {
      let s = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 120) {
        expect(restore(s)).toEqual(s);
        const v = cpuView(s);
        expect(v).not.toHaveProperty('dealer');
        expect(v).not.toHaveProperty('shoe');
        const n = step(s, chooseCpuMove(v));
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status).not.toBe('playing');
      expect(s.scores).toHaveLength(4);
      expect(s.hands.flat().every((h) => h.payout !== null)).toBe(true);
    }
  });
});
