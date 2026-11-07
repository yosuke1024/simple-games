import { describe, it, expect } from 'vitest';
import {
  createSession,
  step,
  cpuView,
  chooseCpuMove,
  restore,
  beats,
  DECK,
  tableCards,
} from './index';
describe('Durak', () => {
  it('requires a higher same-suit card or a trump', () => {
    expect(beats(6, 5, 1)).toBe(true);
    expect(beats(5, 6, 1)).toBe(false);
    expect(beats(18, 12, 1)).toBe(true);
    expect(beats(12, 18, 1)).toBe(false);
    expect(beats(31, 5, 1)).toBe(false);
  });
  it('rejects finishing before an attack and preserves a picked-up bout until attacker finishes', () => {
    let s = createSession(1);
    expect(step(s, { kind: 'done' })).toBeNull();
    s = step(s, { kind: 'attack', card: s.hands[s.turn]![0]! })!;
    const defender = s.turn,
      old = s.hands[defender]!.length;
    s = step(s, { kind: 'take' })!;
    expect(s.taking).toBe(true);
    expect(s.turn).toBe(s.attacker);
    s = step(s, { kind: 'done' })!;
    expect(s.hands[defender]!.length).toBeGreaterThanOrEqual(old + 1);
    expect(s.turn).toBe(s.attacker);
    expect(s.table).toEqual([]);
  });
  it('completes games, keeps the trump last in stock and resumes every legal state', () => {
    for (let seed = 0; seed < 30; seed++) {
      let s = createSession(seed),
        moves = 0;
      while (s.status === 'playing' && moves++ < 5000) {
        expect(restore(s), `seed ${seed}, move ${moves}`).toEqual(s);
        if (s.stock.length) expect(s.stock[0]).toBe(s.trump);
        const n = step(s, chooseCpuMove(cpuView(s)));
        expect(n).not.toBeNull();
        s = n!;
      }
      expect(s.status, `seed ${seed}`).not.toBe('playing');
      expect(
        [...s.hands.flat(), ...s.stock, ...s.discarded, ...tableCards(s.table)].sort(
          (a, b) => a - b,
        ),
      ).toEqual(DECK);
      expect(s.stock).toEqual([]);
    }
  });
  it('rejects invented cards and duplicated stock on restore', () => {
    const s = createSession(8);
    expect(restore({ ...s, stock: [...s.stock, 2] })).toBeNull();
    expect(restore({ ...s, stock: [...s.stock, s.stock[0]] })).toBeNull();
    expect(step(s, { kind: 'defend', card: s.hands[s.turn]![0]! })).toBeNull();
  });
});
