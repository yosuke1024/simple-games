import { describe, it, expect } from 'vitest';
import { createSession, act, canPlay, chooseCpuMove, cpuView, restore } from './index';
describe('Sevens', () => {
  it('requires a contiguous seven run without an A–K tunnel or a forfeit gap', () => {
    expect(canPlay(5, [6])).toBe(true);
    expect(canPlay(7, [6])).toBe(true);
    expect(canPlay(4, [6])).toBe(false);
    expect(canPlay(0, [6, 12])).toBe(false);
    expect(canPlay(2, [6, 1])).toBe(false);
    expect(canPlay(4, [6, 5, 2])).toBe(true);
  });
  it('finishes 240 games with valid saves, complete cards and unique rankings', () => {
    for (let seed = 0; seed < 240; seed++) {
      let s = createSession(seed);
      expect(s.table).toEqual([6, 19, 32, 45]);
      for (let n = 0; n < 90 && s.status === 'playing'; n++) {
        expect(restore(s), `seed ${seed} move ${n}`).not.toBeNull();
        const v = cpuView(s);
        expect(Object.keys(v)).not.toContain('hands');
        s = act(s, chooseCpuMove(v))!;
        expect(s).not.toBeNull();
        expect(new Set([...s.hands.flat(), ...s.table]).size).toBe(52);
      }
      expect(s.status).not.toBe('playing');
      expect([...s.order].sort()).toEqual([0, 1, 2, 3]);
    }
  });
  it('exposes all cards on the fourth pass, after three allowed passes', () => {
    const s = { ...createSession(2), turn: 1 as const, passes: [0, 3, 0, 0] },
      hand = [...s.hands[1]!];
    const next = act(s, { kind: 'pass' })!;
    expect(next.eliminated).toContain(1);
    expect(next.hands[1]).toEqual([]);
    expect(next.table).toEqual(expect.arrayContaining(hand));
  });
  it('rejects invalid cards and damaged saves', () => {
    const s = createSession(1);
    expect(act(s, { kind: 'play', card: 99 })).toBeNull();
    expect(restore({ ...s, passes: [0, 5, 0, 0] })).toBeNull();
    expect(restore({ ...s, table: [6, 19, 32] })).toBeNull();
  });
});
