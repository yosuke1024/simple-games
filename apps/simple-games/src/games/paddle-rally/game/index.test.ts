import { describe, expect, it } from 'vitest';
import { createSession, movePaddle, parseSession, serve, step, type Session } from './index';
describe('Paddle Rally physics and saves', () => {
  it('waits for serve and clamps the player to the court', () => {
    const s = createSession('easy');
    expect(step(s, 1)).toBe(s);
    expect(movePaddle(s, -100).player).toBe(40);
    expect(movePaddle(s, 900).player).toBe(280);
    expect(serve(s).vy).toBeGreaterThan(0);
  });
  it('reflects side walls and both paddle faces without tunnelling', () => {
    const s = serve(createSession('normal'));
    expect(step({ ...s, x: 7, vx: -180 }, 1 / 30).vx).toBe(180);
    expect(step({ ...s, x: 313, vx: 180 }, 1 / 30).vx).toBe(-180);
    const bottom = step({ ...s, x: 180, y: 379, vx: 0, vy: 300 }, 1 / 30);
    expect(bottom.vy).toBeLessThan(0);
    expect(bottom.vx).toBeGreaterThan(0);
    const top = step({ ...s, x: 160, y: 40, vx: 0, vy: -300 }, 1 / 30);
    expect(top.vy).toBeGreaterThan(0);
  });
  it('scores exactly once and waits before the next point; five ends the match', () => {
    const s = serve(createSession('hard'));
    const point = step({ ...s, x: 10, y: -5, vy: -250 }, 1 / 30);
    expect(point.playerScore).toBe(1);
    expect(point.serving).toBe(true);
    expect(step(point, 1 / 30)).toBe(point);
    expect(step({ ...s, playerScore: 4, x: 10, y: -5, vy: -250 }, 1 / 30).status).toBe('won');
    expect(step({ ...s, cpuScore: 4, x: 10, y: 425, vy: 250 }, 1 / 30).status).toBe('lost');
  });
  it('validates finite snapshots and rejects impossible or terminal saves', () => {
    const s = serve(createSession('hard'));
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    for (const patch of [
      { x: NaN },
      { vx: Infinity },
      { playerScore: 5 },
      { playerScore: 0.5 },
      { mode: 'bad' },
      { vy: 0 },
      { status: 'won' },
      { serving: true },
    ]) {
      expect(parseSession({ ...s, ...patch })).toBeNull();
    }
  });
  it('stays bounded during deterministic matches in all difficulties', () => {
    for (const mode of ['easy', 'normal', 'hard'] as const) {
      let s: Session = serve(createSession(mode));
      for (let frame = 0; frame < 25000 && s.status === 'playing'; frame++) {
        if (s.serving) s = serve(s);
        s = step(movePaddle(s, 160 + Math.sin(frame / 79) * 120), 1 / 60);
        if (s.status === 'playing') expect(parseSession(s)).not.toBeNull();
      }
      expect(s.status).not.toBe('playing');
    }
  });
});
