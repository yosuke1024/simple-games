/**
 * Golden boards: two levels pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must see the same wall. Any change to the rng, the
 * generator, the level table, or BOARD_SEED that moves a board will fail
 * here, which is the point: it has to be a decision rather than a side
 * effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_SEED } from './constants';
import { boardToString, buildBricks } from './generator';

describe('boards that must never change', () => {
  it('level 1 is unchanged', () => {
    // Rows top to bottom: '#' brick, 'o' ball brick, '.' gap.
    expect(boardToString(buildBricks(BOARD_SEED, 1))).toBe('########/#..##..#/o.####.#');
  });

  it('level 50 is unchanged', () => {
    expect(boardToString(buildBricks(BOARD_SEED, 50))).toBe(
      '########/.######./###o####/.######./##.##.##',
    );
  });
});
