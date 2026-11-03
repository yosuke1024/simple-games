import { describe, it, expect } from 'vitest';
import { createSession, act, chooseCpuMove, cpuView, sourceSeat, restore, rankOf } from './index';
describe('Old Maid', () => {
  it('finishes 500 games, preserving the Joker and all cards with pair-free hands', () => {
    for (let seed = 0; seed < 500; seed++) {
      let s = createSession(seed ^ 0x80000000);
      for (let n = 0; n < 1000 && s.status === 'playing'; n++) {
        expect(restore(s), `seed ${seed} move ${n}`).not.toBeNull();
        expect(Object.keys(cpuView(s)).sort()).toEqual(['count', 'randomSeed']);
        const next = act(s, chooseCpuMove(cpuView(s)));
        expect(next).not.toBeNull();
        s = next!;
        expect(new Set([...s.hands.flat(), ...s.discard]).size).toBe(53);
        expect(s.discard).not.toContain(52);
        for (const h of s.hands) {
          const ranks = h.filter((c) => c !== 52).map(rankOf);
          expect(new Set(ranks).size).toBe(ranks.length);
        }
      }
      expect(s.status).not.toBe('playing');
      if (s.status === 'lost') expect(s.hands[0]).toEqual([52]);
      else expect(s.hands[0]).toEqual([]);
    }
  });
  it('never publishes an unpaired CPU draw', () => {
    let s = createSession(19);
    for (let i = 0; i < 80 && s.status === 'playing'; i++) {
      const seat = s.turn;
      s = act(s, chooseCpuMove(cpuView(s)))!;
      if (seat !== 0 && s.event.kind === 'draw') expect(s.event.cards).toEqual([]);
    }
  });
  it('skips empty seats and rejects invalid draws and damaged saves', () => {
    const s = createSession(8);
    expect(sourceSeat(s)).not.toBe(s.turn);
    expect(act(s, { kind: 'draw', index: -1 })).toBeNull();
    expect(act(s, { kind: 'draw', index: 99 })).toBeNull();
    expect(restore({ ...s, discard: [52, ...s.discard] })).toBeNull();
    expect(restore({ ...s, turn: 9 })).toBeNull();
  });
});
