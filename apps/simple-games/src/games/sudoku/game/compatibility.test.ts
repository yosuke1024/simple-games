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
    const sampled = [1, 10, 11, 25, 26, 45, 46, 70, 71, 85, 86, 100];
    expect(sampled.map(difficultyForLevel)).toEqual([
      'easy',
      'easy',
      'easy',
      'medium',
      'hard',
      'medium',
      'medium',
      'hard',
      'hard',
      'hard',
      'hard',
      'hard',
    ]);
  });

  /**
   * The table of §9 is a promise about counts, not a tendency. Dealing fixed
   * counts per band is what makes it true; this is the test that would notice
   * a return to rolling each level independently, which drifted far enough at
   * this list length to invert the last band.
   */
  it('deals each band the mix its table states', () => {
    const bands: Array<[number, number, number, number, number]> = [
      [1, 10, 10, 0, 0],
      [11, 25, 9, 6, 0],
      [26, 45, 5, 13, 2],
      [46, 70, 3, 16, 6],
      [71, 85, 0, 8, 7],
      [86, 100, 0, 5, 10],
    ];
    for (const [from, to, easy, medium, hard] of bands) {
      const tiers = Array.from({ length: to - from + 1 }, (_, i) => difficultyForLevel(from + i));
      const count = (want: string) => tiers.filter((tier) => tier === want).length;
      expect([count('easy'), count('medium'), count('hard')], `band ${from}-${to}`).toEqual([
        easy,
        medium,
        hard,
      ]);
    }
  });
});
