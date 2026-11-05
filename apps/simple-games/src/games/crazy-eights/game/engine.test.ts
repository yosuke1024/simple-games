import { describe, it, expect } from 'vitest';
import { createSession, step, cpuView, chooseCpuMove, restore, canPlay, penalty } from './index';
describe('Crazy Eights', () => {
  it('makes eights wild but requires the next suit to be chosen', () => {
    const s = createSession(9),
      seat = s.hands.findIndex((h) => h.includes(7));
    if (seat >= 0) {
      s.turn = seat;
      expect(step(s, { kind: 'play', card: 7 })).toBeNull();
      expect(step(s, { kind: 'play', card: 7, suit: 2 })?.suit).toBe(2);
    }
    expect(canPlay(7, 24, 2)).toBe(true);
    expect(canPlay(0, 24, 2)).toBe(false);
    expect(penalty([7, 0, 12, 4])).toBe(66);
  });
  it('rejects premature passes, cards not held and malformed saves', () => {
    const s = createSession(1);
    expect(step(s, { kind: 'pass' })).toBeNull();
    expect(step(s, { kind: 'play', card: s.stock[0]! })).toBeNull();
    expect(restore({ ...s, stock: [...s.stock, s.stock[0]] })).toBeNull();
    expect(restore({ ...s, suit: 8 })).toBeNull();
    expect(restore(null)).toBeNull();
  });
  it('finishes seeded games without losing cards and resumes at every turn', () => {
    for (let seed = 0; seed < 30; seed++) {
      let s = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 3000) {
        expect(restore(s)).toEqual(s);
        const before = JSON.stringify(s),
          n = step(s, chooseCpuMove(cpuView(s)));
        expect(n).not.toBeNull();
        expect(JSON.stringify(s)).toBe(before);
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(s.winners.length).toBeGreaterThan(0);
      expect([...s.hands.flat(), ...s.stock, ...s.discard].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 52 }, (_, i) => i),
      );
    }
  });
  it('does not give CPU hidden stock or opposing cards', () => {
    const s = createSession(4),
      v = cpuView(s);
    expect(v).not.toHaveProperty('seed');
    expect(v).not.toHaveProperty('stock');
    expect(v).not.toHaveProperty('hands');
    expect(v.hand).toEqual(s.hands[s.turn]);
  });
});
