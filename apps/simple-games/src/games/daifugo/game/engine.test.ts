import { describe, it, expect } from 'vitest';
import {
  createSession,
  act,
  chooseCpuMove,
  cpuView,
  legalGroups,
  beats,
  restore,
  exchangeCount,
  power,
} from './index';
describe('Daifugo rules and fair CPU', () => {
  it('orders ranks, equal groups, Joker, revolution and spade-three', () => {
    expect(power(2)).toBeLessThan(power(0));
    expect(power(0)).toBeLessThan(power(1));
    expect(beats([52], [1], false)).toBe(true);
    expect(beats([2], [52], false)).toBe(true);
    expect(beats([15], [52], false)).toBe(false);
    expect(beats([3, 16], [2], false)).toBe(false);
    expect(beats([3, 16], [2, 15], false)).toBe(true);
    expect(beats([3, 16], [2, 15], true)).toBe(false);
    expect(beats([3, 17], [], false)).toBe(false);
    expect(beats([52, 3], [2, 15], false)).toBe(true);
  });
  it('conserves 53 cards, restores ongoing positions and finishes 240 seeded rounds', () => {
    for (let seed = 0; seed < 240; seed++) {
      let s = createSession(seed ^ 0x80000000);
      for (let n = 0; n < 300 && s.status === 'playing'; n++) {
        expect(restore(s), `seed ${seed}, move ${n}`).not.toBeNull();
        const v = cpuView(s);
        expect(Object.keys(v)).not.toContain('hands');
        const next = act(s, chooseCpuMove(v));
        expect(next).not.toBeNull();
        s = next!;
        const all = [...s.hands.flat(), ...s.discard, ...s.table];
        expect(all.length).toBe(53);
        expect(new Set(all).size).toBe(53);
      }
      expect(s.status).not.toBe('playing');
      expect(new Set(s.order).size).toBe(4);
    }
  });
  it('exchanges simultaneously and requires a choice before revealing incoming cards', () => {
    const before = createSession(24, [0, 1, 2, 3]);
    expect(exchangeCount(before)).toBe(2);
    expect(restore(before)).not.toBeNull();
    const cards = before.hands[0]!.slice(0, 2);
    expect(act(before, { kind: 'exchange', cards: [cards[0]!] })).toBeNull();
    const after = act(before, { kind: 'exchange', cards })!;
    expect(after.phase).toBe('play');
    expect(after.turn).toBe(3);
    expect(after.hands[3]).toEqual(expect.arrayContaining(cards));
    expect(new Set(after.hands.flat()).size).toBe(53);
    expect(act(after, { kind: 'exchange', cards })).toBeNull();
  });
  it('rejects forged cards, duplicates and inconsistent partitions', () => {
    const s = createSession(7);
    expect(act(s, { kind: 'play', cards: [99] })).toBeNull();
    expect(
      act(s, { kind: 'play', cards: [s.hands[s.turn]![0]!, s.hands[s.turn]![0]!] }),
    ).toBeNull();
    expect(restore({ ...s, hands: [[], ...s.hands.slice(1)] })).toBeNull();
    expect(restore({ ...s, phase: 'exchange' })).toBeNull();
    expect(
      legalGroups([2, 15, 28, 41, 52], [], false).every((g) => new Set(g).size === g.length),
    ).toBe(true);
  });
  it('clears on eight, skips passed seats and applies four-card revolution', () => {
    const s = {
      ...createSession(1),
      turn: 0 as const,
      leader: 0 as const,
      hands: [
        [7, 8],
        [3, 9],
        [4, 10],
        [5, 11],
      ],
      discard: [],
      table: [],
      order: [],
    };
    const eight = act(s, { kind: 'play', cards: [7] })!;
    expect(eight.table).toEqual([]);
    expect(eight.turn).toBe(0);
    const base = {
      ...s,
      hands: [
        [2, 15, 28, 41, 8],
        [3, 16, 29, 42, 9],
        [4, 10],
        [5, 11],
      ],
    };
    const revolution = act(base, { kind: 'play', cards: [2, 15, 28, 41] })!;
    expect(revolution.revolution).toBe(true);
    expect(revolution.table.length).toBe(4);
    expect(act(revolution, { kind: 'pass' })!.passed).toContain(1);
  });
});
