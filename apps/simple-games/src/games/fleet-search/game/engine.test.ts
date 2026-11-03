import { describe, it, expect } from 'vitest';
import {
  act,
  chooseTarget,
  createSession,
  cpuAction,
  generateFleet,
  knowledge,
  placement,
  validFleet,
  type Session,
} from './index';
describe('Fleet Search rules', () => {
  it('generates four straight, separated ships', () => {
    for (let seed = 0; seed < 200; seed++) {
      const ships = generateFleet(seed);
      expect(validFleet(ships)).toBe(true);
      expect(ships.flat()).toHaveLength(11);
      expect(ships).toEqual(generateFleet(seed));
    }
  });
  it('rejects wrapping, contact and illegal setup changes', () => {
    expect(placement(7, 2, false)).toBeNull();
    const s = createSession('normal', 1);
    expect(act(s, { type: 'place', ship: 0, cell: 63, vertical: false })).toBeNull();
    const started = act(s, { type: 'start' })!;
    expect(act(started, { type: 'shuffle' })).toBeNull();
    expect(act(started, { type: 'shot', cell: 64 })).toBeNull();
  });
  it('passes the turn even on a hit and cannot fire twice at one cell', () => {
    let s = act(createSession('normal', 1), { type: 'start' })!;
    const c = s.fleets[1][0]![0]!;
    s = act(s, { type: 'shot', cell: c })!;
    expect(s.phase).toBe('cpu');
    s = act(s, cpuAction(s))!;
    expect(act(s, { type: 'shot', cell: c })).toBeNull();
  });
  it('CPU choices depend on visible knowledge, not hidden placement', () => {
    const a = act(createSession('hard', 12), { type: 'start' })!,
      b: Session = { ...a, fleets: [generateFleet(999), a.fleets[1]] };
    expect(knowledge(a, 1)).toEqual(knowledge(b, 1));
    expect(cpuAction(a)).toEqual(cpuAction(b));
  });
  it('finishes legal self-play without repeat shots at every difficulty', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const)
      for (let seed = 0; seed < 12; seed++) {
        let s = act(createSession(mode, seed), { type: 'start' })!;
        let n = 0;
        while (s.status === 'playing' && n++ < 128) {
          const side = s.phase === 'player' ? 0 : 1,
            view = knowledge(s, side),
            cell = chooseTarget(view, mode, seed * 130 + n);
          expect(view.blocked).not.toContain(cell);
          s = act(s, { type: 'shot', cell })!;
          expect(s).not.toBeNull();
        }
        expect(s.status).not.toBe('playing');
        expect(n).toBeLessThanOrEqual(128);
      }
  });
});
