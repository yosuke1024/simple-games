/**
 * Golden boards: level 1 and one daily, pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same board — and a recorded best (the
 * fewest moves, the fastest time) only means something if the board it was set
 * on still exists. Any change to the rng, to the shuffle walk, or to the level
 * table that moves a board will fail here, which is the point: changing these
 * numbers costs every player their recorded bests, so it has to be a decision
 * rather than a side effect.
 *
 * If a change here is intended, regenerate the strings and say so in the commit
 * message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { tilesToString } from './generator';
import { shuffleDepthForLevel, sizeForLevel } from './levels';
import { createDailySession, createLevelSession } from './session';

describe('boards that must never change', () => {
  it('level 1 is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.size).toBe(3);
    expect(shuffleDepthForLevel(1)).toBe(20);
    // Row-major, base 36, '0' is the gap:
    //   4 3 _
    //   7 1 8
    //   6 2 5
    expect(tilesToString(session.tiles)).toBe('430718625');
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(4);
    //   1 11  _  7
    //  14  9  8  5
    //  12  6 10  3
    //  13  4  2 15
    expect(tilesToString(session.tiles)).toBe('1b07e985c6a3d42f');
  });

  it('the level table is unchanged at every band boundary', () => {
    const sampled = [1, 10, 11, 30, 31, 65, 66, 100];
    expect(sampled.map(sizeForLevel)).toEqual([3, 3, 3, 3, 4, 4, 5, 5]);
    expect(sampled.map(shuffleDepthForLevel)).toEqual([20, 45, 45, 90, 60, 180, 90, 400]);
  });
});
