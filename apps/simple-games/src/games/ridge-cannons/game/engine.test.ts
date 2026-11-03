import { describe, it, expect } from 'vitest';
import { act, createSession, cpuAction, simulate, wind } from './index';
describe('Ridge Cannons rules', () => {
  it('is deterministic and mirrors calm trajectories', () => {
    const a = createSession('normal', 21),
      b = createSession('normal', 21);
    expect(a).toEqual(b);
    expect(simulate(a, 0, { angle: 50, power: 90 })).toEqual(
      simulate(b, 0, { angle: 50, power: 90 }),
    );
  });
  it('keeps the wind for both turns and never exceeds 12 rounds', () => {
    let s = createSession('hard', 3);
    const w = wind(s);
    s = act(s, { angle: 10, power: 20 })!;
    expect(wind(s)).toBe(w);
    while (s.status === 'playing') s = act(s, { angle: 10, power: 20 })!;
    expect(s.actions.length).toBeLessThanOrEqual(24);
    expect(act(s, { angle: 40, power: 80 })).toBeNull();
  });
  it('rejects invalid input without touching the session', () => {
    const s = createSession('easy', 0);
    for (const a of [
      { angle: 0, power: 50 },
      { angle: 50, power: 101 },
      { angle: 50.5, power: 80 },
      { angle: NaN, power: 60 },
    ])
      expect(act(s, a)).toBeNull();
    expect(s.actions).toEqual([]);
  });
  it('finds shots across generated ridges and CPU turns remain bounded', () => {
    let damage = 0;
    for (let seed = 0; seed < 20; seed++) {
      const s = createSession('hard', seed);
      s.phase = 'cpu';
      const a = cpuAction(s);
      expect(a).toEqual(cpuAction(s));
      const shot = simulate(s, 1, a);
      expect(shot.path.length).toBeLessThanOrEqual(501);
      damage += shot.damage[0];
    }
    expect(damage).toBeGreaterThan(200);
  });
});
