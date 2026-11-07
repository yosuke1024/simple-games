import { describe, it, expect } from 'vitest';
import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  restore,
  evaluate,
  canRaise,
  random,
  type Action,
  type Session,
} from './index';
const cs = (s: string) =>
  s.split(' ').map((x) => 'SHDC'.indexOf(x[1]!) * 13 + 'A23456789TJQK'.indexOf(x[0]!));
function river(hands: string[], board: string, stacks: number[]): Session {
  const s = createSession(1);
  s.hands = hands.map(cs);
  s.board = cs(board);
  const available = Array.from({ length: 52 }, (_, i) => i).filter(
    (c) => ![...s.hands.flat(), ...s.board].includes(c),
  );
  s.burned = available.splice(0, 3);
  s.deck = available;
  s.phase = 'river';
  s.stacks = stacks;
  s.contributions = [0, 0, 0, 0];
  s.bets = [0, 0, 0, 0];
  s.bet = 0;
  s.turn = 0;
  s.actedAt = [-1, -1, -1, -1];
  return s;
}
describe('Texas Hold’em', () => {
  it('evaluates the best five, including a wheel and board-only ties', () => {
    const examples = [
      '2S 5H 7D 9C JS',
      'AS AH 5D 8C JS',
      'AS AH 5D 5C JS',
      'AS AH AD 8C JS',
      'AS 2H 3D 4C 5S',
      '2S 5S 7S 9S JS',
      'AS AH AD 8C 8S',
      'AS AH AD AC JS',
      '9S TS JS QS KS',
    ];
    examples.forEach((hand, i) => expect(evaluate(cs(hand)).category).toBe(i));
    expect(evaluate(cs('AS 2H 3D 4C 5S KH QD')).ranks).toEqual([5]);
    expect(evaluate(cs('TS JS QS KS AS 2H 2D')).value).toBe(
      evaluate(cs('TS JS QS KS AS 9H 9D')).value,
    );
    expect(evaluate(cs('AS AH KD QC JS 2D 3D')).value).toBeGreaterThan(
      evaluate(cs('AS AH KD QC TS 2D 3D')).value,
    );
  });
  it('returns an uncalled excess and prevents the shortest stack winning a side pot', () => {
    let s = river(['AS AH', 'KS KH', 'QS QH', '3S 4H'], '2D 5C 7D 9C JD', [100, 200, 300, 3400]);
    for (const kind of ['all-in', 'all-in', 'all-in', 'fold'] as const) {
      const n = step(s, { kind });
      expect(n).not.toBeNull();
      s = n!;
    }
    expect(s.phase).toBe('hand');
    expect(s.returned).toEqual([0, 0, 100, 0]);
    expect(s.pots.map((p) => p.amount)).toEqual([300, 200]);
    expect(s.pots.map((p) => p.winners)).toEqual([[0], [1]]);
    expect(s.stacks).toEqual([300, 200, 100, 3400]);
    expect(restore(s)).toEqual(s);
  });
  it('splits ties and gives odd chips clockwise after the button', () => {
    let s = river(['2H 3H', '4H 5H', '6H 7H', '8H 9H'], 'TS JS QS KS AS', [999, 999, 999, 1000]);
    s.dealer = 0;
    s.contributions = [1, 1, 1, 0];
    s.bets = [1, 1, 1, 0];
    s.bet = 1;
    s.folded = [false, false, true, true];
    s = step(s, { kind: 'check' })!;
    s = step(s, { kind: 'check' })!;
    expect(s.payouts).toEqual([1, 2, 0, 0]);
    expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4000);
  });
  it('does not reopen raising for one short all-in, but cumulative full increases do', () => {
    let s = river(['AS AH', 'KS KH', 'QS QH', '3S 4H'], '2D 5C 7D 9C JD', [1825, 1825, 150, 200]);
    s = step(s, { kind: 'raise', to: 100 })!;
    s = step(s, { kind: 'call' })!;
    s = step(s, { kind: 'all-in' })!;
    const single = step(s, { kind: 'fold' })!;
    expect(single.turn).toBe(0);
    expect(canRaise(cpuView(single))).toBe(false);
    expect(step(single, { kind: 'raise', to: 250 })).toBeNull();
    s = step(s, { kind: 'all-in' })!;
    expect(s.turn).toBe(0);
    expect(canRaise(cpuView(s))).toBe(true);
    expect(step(s, { kind: 'raise', to: 300 })).not.toBeNull();
  });
  it('starts heads-up with the button in the small blind acting first', () => {
    const s = createSession(9);
    s.phase = 'hand';
    s.stacks = [2000, 0, 2000, 0];
    s.dealer = 3;
    const n = step(s, { kind: 'next' })!;
    expect(n.dealer).toBe(0);
    expect(n.bets).toEqual([10, 0, 20, 0]);
    expect(n.turn).toBe(0);
    let p = step(n, { kind: 'call' })!;
    p = step(p, { kind: 'check' })!;
    expect(p.phase).toBe('flop');
    expect(p.turn).toBe(2);
  });
  it('runs seeded tables to a winner while conserving chips and restoring every turn', () => {
    for (let seed = 0; seed < 8; seed++) {
      let s = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 20000) {
        expect(restore(s), `seed ${seed} move ${moves} ${s.phase}`).toEqual(s);
        const n = step(s, chooseCpuMove(cpuView(s)));
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4000);
      expect(s.winners).toHaveLength(1);
    }
  }, 30000);
  it('rejects malformed saves without giving hidden cards to the CPU', () => {
    const s = createSession(2),
      v = cpuView(s);
    expect(v).not.toHaveProperty('hands');
    expect(v).not.toHaveProperty('seed');
    expect(v).not.toHaveProperty('deck');
    expect(restore({ ...s, stacks: [1000, 1000, 1000, 1000] })).toBeNull();
    expect(restore({ ...s, deck: [...s.deck, s.deck[0]] })).toBeNull();
  });
  it('does not charge the same survivor a second big blind when entering heads-up', () => {
    const s = createSession(3);
    s.phase = 'hand';
    s.dealer = 3;
    s.smallBlind = 0;
    s.bigBlind = 2;
    s.stacks = [2000, 0, 2000, 0];
    const n = step(s, { kind: 'next' })!;
    expect(n.bigBlind).toBe(0);
    expect(n.smallBlind).toBe(2);
    expect(n.dealer).toBe(2);
    expect(n.turn).toBe(2);
  });
  it('does not demand the nominal full blind after all other deep stacks fold', () => {
    let s = createSession(4);
    s.phase = 'hand';
    s.bigBlind = 0;
    s.stacks = [2000, 5, 1995, 0];
    s = step(s, { kind: 'next' })!;
    expect(s.bigBlind).toBe(1);
    expect(s.turn).toBe(2);
    expect(s.bet).toBe(20);
    s = step(s, { kind: 'fold' })!;
    expect(s.phase).toBe('hand');
    expect(s.returned[0]).toBe(5);
    expect(s.pots[0]!.amount).toBe(10);
    expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4000);
  });
  it('conserves chips under varied legal human-style betting, not only the CPU policy', () => {
    for (let seed = 20; seed < 40; seed++) {
      let s = createSession(seed),
        moves = 0;
      const rng = random(seed);
      while (s.status === 'playing' && moves++ < 5000) {
        expect(restore(s), `seed ${seed}, move ${moves}`).toEqual(s);
        const v = cpuView(s),
          call: Action = { kind: s.bets[s.turn]! < s.bet ? 'call' : 'check' };
        const choices: Action[] =
          s.phase === 'hand' ? [{ kind: 'next' }] : [{ kind: 'fold' }, call, call, call];
        if (canRaise(v)) {
          choices.push(
            {
              kind: 'raise',
              to: Math.min(s.bet + s.minRaise, s.bets[s.turn]! + s.stacks[s.turn]!),
            },
            { kind: 'all-in' },
          );
        }
        const n = step(s, choices[Math.floor(rng() * choices.length)]!);
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(s.stacks.reduce((a, b) => a + b, 0)).toBe(4000);
    }
  });
});
