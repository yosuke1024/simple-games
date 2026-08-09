/**
 * Golden boards: level 1 and one daily, pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same board — and a personal best
 * only means something if the board it was set on still exists. Any change
 * to the rng, the peel search, the pair pool, or the layout data that moves
 * a board will fail here, which is the point: changing these strings is a
 * decision, not a side effect.
 *
 * This pins GENERATION only. It says nothing about saved games surviving —
 * that is the persistence round-trip in storage/gamePersistence.test.ts
 * (RELEASE_CHECKLIST §0: "golden テストだけでは足りない").
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { generateBoard } from './generator';
import { DAILY_PARAMS, levelParams } from './layouts';
import { createDailySession, createLevelSession } from './session';

describe('golden boards', () => {
  it('level 1 is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.layout.id).toBe('sprout');
    expect(session.faces.join(',')).toBe(
      'b2,c9,b8,b8,b2,o2,c7,b4,o7,o2,c7,o1,we,c9,o1,o3,o3,b4,ws,dr,dr,o7,ws,we',
    );
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.layout.id).toBe('turtle');
    expect(session.faces.join(',')).toBe(
      'b1,wn,c9,b6,wn,f4,c5,b4,b8,o2,dw,o5,o4,o1,c9,ws,s3,o5,c5,ww,b7,wn,o7,c3,' +
        's4,o8,b3,o6,o1,b8,o9,c6,b9,o1,b9,c8,o6,b5,dg,o6,b9,c8,o5,b4,f1,dr,f3,c7,' +
        'c3,o9,o4,c2,b2,b5,o1,c8,ww,b2,b7,wn,c7,f2,c6,c5,o3,c1,b2,o8,ww,b1,ww,s2,' +
        'b9,b1,we,o6,c6,c3,b5,b6,c2,b3,o2,o8,c2,c4,c5,o7,s1,o2,o4,ws,b6,c9,b3,o3,' +
        'b8,o7,c1,b7,b6,b7,we,dw,ws,c1,we,dr,c7,o5,c8,ws,o9,dw,b1,c4,b2,o8,c4,dg,' +
        'b5,b3,c9,c4,o2,c7,o7,we,o9,b4,dg,dr,o3,c6,dr,dw,b8,c2,o4,o3,c1,b4,c3,dg',
    );
  });

  it('the peel search itself is unchanged on level 1 (order prefix)', () => {
    const board = generateBoard(levelParams(1), 'mj-level-1');
    expect(board.usedWitness).toBe(false);
    expect(board.solvedOrder.slice(0, 8)).toEqual([21, 8, 20, 19, 12, 23, 0, 4]);
  });

  it('the level→layout curve is unchanged at sampled levels', () => {
    const sampled = [1, 8, 9, 16, 17, 25, 26, 35, 36, 45, 46, 56, 57, 67, 68, 78, 79, 89, 90, 100];
    expect(sampled.map((level) => levelParams(level).layoutId)).toEqual([
      'sprout',
      'sprout',
      'steps',
      'steps',
      'terrace',
      'terrace',
      'courtyard',
      'courtyard',
      'pagoda',
      'pagoda',
      'lantern',
      'lantern',
      'bridge',
      'bridge',
      'keep',
      'keep',
      'garden',
      'garden',
      'turtle',
      'turtle',
    ]);
    expect(DAILY_PARAMS.layoutId).toBe('turtle');
  });
});
