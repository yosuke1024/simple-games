/**
 * Golden boards: level 1 and one daily, pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same board — and a recorded best
 * (fewest pours, fastest time) only means something if the board it was set
 * on still exists. Any change to the rng, the deal, the solver's acceptance,
 * or the level table that moves a board will fail here, which is the point:
 * changing these strings costs every player their recorded bests, so it has
 * to be a decision rather than a side effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { tubesToString } from './generator';
import { createDailySession, createLevelSession } from './session';

describe('boards that must never change', () => {
  it('level 1 is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.colors).toBe(3);
    // Tubes bottom-to-top, joined by '.'; the two trailing dots are the empty
    // spare tubes (§1).
    expect(tubesToString(session.tubes)).toBe('2112.2021.0001..');
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.colors).toBe(6);
    expect(tubesToString(session.tubes)).toBe('1230.1524.4022.4433.5153.5010..');
  });
});
