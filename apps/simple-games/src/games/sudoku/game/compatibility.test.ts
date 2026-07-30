/**
 * Golden boards: level 1 and one daily, pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same puzzle — and a personal best time
 * only means something if the board it was set on still exists. Any
 * refactoring of the rng, the dig order, or the technique set that changes a
 * board will fail here, which is the point: changing these numbers is a
 * decision, not a side effect.
 *
 * If a change here is intended, regenerate the strings and say so in the commit
 * message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { gridToString } from './generator';
import { difficultyForLevel } from './levels';
import { createDailySession, createLevelSession } from './session';

describe('golden puzzles', () => {
  it('level 1 is unchanged', () => {
    const session = createLevelSession(1);
    expect(session.difficulty).toBe('easy');
    expect(gridToString(session.board.givens)).toBe(
      '506002700' +
        '090001504' +
        '008970006' +
        '800000263' +
        '160000057' +
        '973000008' +
        '700094600' +
        '604100070' +
        '009600402',
    );
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.difficulty).toBe('medium');
    expect(gridToString(session.board.givens)).toBe(
      '080000500' +
        '010090026' +
        '000001700' +
        '300008005' +
        '100367002' +
        '600500003' +
        '003400000' +
        '740080050' +
        '001000080',
    );
  });

  it('the level tier curve is unchanged at sampled levels', () => {
    const sampled = [1, 20, 21, 60, 61, 150, 151, 400, 401, 700, 701, 999];
    expect(sampled.map(difficultyForLevel)).toEqual([
      'easy',
      'easy',
      'easy',
      'easy',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'hard',
      'medium',
      'medium',
    ]);
  });
});
