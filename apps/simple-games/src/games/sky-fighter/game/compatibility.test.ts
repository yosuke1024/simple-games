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
 *
 * These strings were regenerated once, for the six-craft roster (§4): the wave
 * mix now draws a *kind* where it used to draw a size, so every formation in
 * the game moved. BOARD_SEED went to `v2` in the same commit rather than
 * leaving `v1` naming skies no v1 player ever flew. What it cost: a player who
 * knew a stage by heart has to learn it again. Nothing was saved per stage
 * beyond which ones are unlocked (storage/schemas.ts), so no record was
 * invalidated by the move.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_SEED } from './constants';
import type { Enemy } from './types';
import { spawnWave } from './waves';

/** kind:x,y,dy per craft — every number that decides what the player meets. */
function waveToString(enemies: readonly Enemy[]): string {
  return enemies
    .map(
      (e) =>
        `${e.kind}:${e.x.toFixed(1)},${e.y.toFixed(1)},${e.dy.toFixed(1)}` +
        (e.fireCooldownMs !== undefined ? `,f${e.fireCooldownMs.toFixed(0)}` : ''),
    )
    .join('|');
}

describe('waves that must never change', () => {
  it('level 1, wave 1 is unchanged', () => {
    expect(waveToString(spawnWave(BOARD_SEED, 1, 0, 1).enemies)).toBe(
      'fighter:72.2,-14.0,61.9|gunship:188.8,-32.0,47.4,f1519|gunship:319.4,-50.0,49.1,f1456',
    );
  });

  it('level 60, wave 3 is unchanged', () => {
    expect(waveToString(spawnWave(BOARD_SEED, 60, 2, 1).enemies)).toBe(
      'darter:28.0,-9.0,154.4|gunship:125.5,-32.0,79.2,f644|fighter:174.7,-50.0,80.0|gunship:268.5,-68.0,89.6,f663|darter:317.3,-81.0,151.3',
    );
  });
});
