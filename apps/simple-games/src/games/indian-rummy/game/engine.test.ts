import { describe, it, expect } from 'vitest';
import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  restore,
  analyze,
  bestDiscard,
  meldKind,
  type Session,
} from './index';
const complete = [0, 1, 2, 16, 17, 18, 8, 21, 34, 12, 25, 38, 51];
describe('Indian Rummy', () => {
  it('distinguishes pure sequences, wild substitutions and duplicate physical copies', () => {
    expect(meldKind([0, 1, 2], 7)).toBe('pure');
    expect(meldKind([4, 5, 6], 7)).toBe('pure');
    expect(meldKind([0, 1, 104], 7)).toBe('sequence');
    expect(meldKind([12, 0, 104], 7)).toBe('sequence');
    expect(meldKind([12, 0, 1], 7)).toBeNull();
    expect(meldKind([0, 52, 1], 7)).toBeNull();
    expect(meldKind([8, 21, 104], 7)).toBe('set');
    expect(meldKind([8, 60, 21], 7)).toBeNull();
    expect(meldKind([6, 19, 104], 7)).toBeNull();
  });
  it('requires two sequences and a pure sequence, with every card used exactly once', () => {
    const a = analyze(complete, 7);
    expect(a.complete).toBe(true);
    expect(a.penalty).toBe(0);
    expect(a.unmatched).toEqual([]);
    expect(analyze([0, 1, 2, 8, 21, 34, 11, 24, 37, 12, 25, 38, 51], 7).complete).toBe(false);
    expect(analyze([0, 1, 104, 16, 17, 105, 8, 21, 34, 12, 25, 38, 51], 7).complete).toBe(false);
  });
  it('validates an explicit declaration and refuses immediate re-discard of a picked card', () => {
    const s = createSession(1);
    s.indicator = 6;
    s.wildRank = 7;
    s.hands[0] = [...complete, 3];
    const rest = Array.from({ length: 106 }, (_, i) => i).filter(
      (c) => !s.hands[0]!.includes(c) && c !== 6,
    );
    for (let p = 1; p < 4; p++) s.hands[p] = rest.splice(0, 13);
    s.discard = [rest.pop()!];
    s.stock = rest;
    s.phase = 'discard';
    s.picked = 3;
    expect(restore(s)).toEqual(s);
    expect(step(s, { kind: 'declare', card: 3 })).toBeNull();
    s.picked = null;
    const n = step(s, { kind: 'declare', card: 3 })!;
    expect(n.status).toBe('won');
    expect(n.winners).toEqual([0]);
    expect(n.penalties[0]).toBe(0);
    expect(n.declaration.flatMap((g) => g.cards).sort((a, b) => a - b)).toEqual(
      [...complete].sort((a, b) => a - b),
    );
  });
  it('finishes seeded deals using only legal, private-information CPU actions', () => {
    for (let seed = 0; seed < 2; seed++) {
      let s: Session = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 1800) {
        expect(restore(s)).toEqual(s);
        const v = cpuView(s);
        expect(v).not.toHaveProperty('stock');
        expect(v).not.toHaveProperty('hands');
        const n = step(s, chooseCpuMove(v));
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(s.winners).toHaveLength(1);
      expect(s.penalties.every((p) => p >= 0 && p <= 80)).toBe(true);
    }
  }, 60000);
  it('rejects duplicated deck identities and wrong hand sizes', () => {
    const s = createSession(4);
    expect(restore({ ...s, stock: [...s.stock, s.stock[0]] })).toBeNull();
    expect(restore({ ...s, phase: 'discard' })).toBeNull();
  });
  it('finds a legal partition with ten interchangeable wild cards', () => {
    const hand = [6, 19, 32, 45, 58, 71, 84, 97, 104, 105, 0, 1, 2, 3];
    const result = bestDiscard(hand, 7);
    expect(result.analysis.complete).toBe(true);
    expect(result.analysis.groups.flatMap((g) => g.cards).sort((a, b) => a - b)).toEqual(
      hand.filter((c) => c !== result.card).sort((a, b) => a - b),
    );
  });
});
