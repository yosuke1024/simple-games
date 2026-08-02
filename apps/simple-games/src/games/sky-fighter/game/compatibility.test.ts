/**
 * Golden waves: two pinned exactly.
 *
 * A level is a promise. Two players on the same level, and one player before
 * and after an app update, must meet the same waves. Any change to the rng,
 * the spawner, the level table, or BOARD_SEED that moves a wave will fail
 * here, which is the point: it has to be a decision rather than a side
 * effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_SEED } from './constants';
import type { Enemy } from './types';
import { spawnWave } from './waves';

/** tier:x,y,dy per craft — every number that decides what the player meets. */
function waveToString(enemies: readonly Enemy[]): string {
  return enemies
    .map(
      (e) =>
        `${e.tier}:${e.x.toFixed(1)},${e.y.toFixed(1)},${e.dy.toFixed(1)}` +
        (e.fireCooldownMs !== undefined ? `,f${e.fireCooldownMs.toFixed(0)}` : ''),
    )
    .join('|');
}

describe('waves that must never change', () => {
  it('level 1, wave 1 is unchanged', () => {
    expect(waveToString(spawnWave(BOARD_SEED, 1, 0, 1).enemies)).toBe(
      '1:55.2,-14.0,56.1|1:246.1,-32.0,51.1',
    );
  });

  it('level 60, wave 3 is unchanged', () => {
    expect(waveToString(spawnWave(BOARD_SEED, 60, 2, 1).enemies)).toBe(
      '1:52.4,-14.0,99.5|0:148.6,-40.0,91.5,f954|0:230.0,-58.0,92.9,f2669|1:325.0,-68.0,91.6',
    );
  });
});
