import { describe, it, expect } from 'vitest';
import { createSession, step, cpuView, chooseCpuMove } from './index';
import { project, validView } from './view';
describe('receiver-specific table view', () => {
  it('validates every seat through a complete deal and rejects hidden-field additions', () => {
    let s = createSession(8),
      moves = 0;
    do {
      for (let seat = 0; seat < 4; seat++) {
        const v = project(s, seat);
        expect(validView(v, seat), `move ${moves}, seat ${seat}`).toBe(true);
        expect(validView(v, (seat + 1) % 4)).toBe(false);
        for (const secret of ['seed', 'stock', 'shoe', 'deck', 'burned']) {
          expect(v).not.toHaveProperty(secret);
          expect(validView({ ...v, [secret]: [] }, seat)).toBe(false);
        }
        expect(validView({ ...v, event: { ...v.event, secret: 123 } }, seat)).toBe(false);
      }
      if (s.status !== 'playing') break;
      s = step(s, chooseCpuMove(cpuView(s)))!;
      expect(s).not.toBeNull();
    } while (moves++ < 20000);
    expect(s.status).not.toBe('playing');
  }, 60000);
  it('keeps the same public view when other hidden cards are exchanged', () => {
    const s = createSession(1),
      before = project(s, 0);
    [s.dealer[1], s.shoe[0]] = [s.shoe[0]!, s.dealer[1]!];
    expect(project(s, 0)).toEqual(before);
    const v = project(s, 0);
    v.event.cards.push(999);
    expect(s.event.cards).not.toContain(999);
  });
});
