/**
 * A golden track: one seed, pinned exactly.
 *
 * A score is only a record if the game it was set in still exists. Any change
 * to the rng, the obstacle table, the gap rule, the speed curve or the jump
 * would move this sequence — and every score already on a player's device
 * would then belong to a game that is gone. Failing here is the point: it has
 * to be a decision rather than a side effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing records.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, jump, step } from './engine';
import type { GameState } from './types';

const STEP_MS = 1000 / 120;

/**
 * The board's own loop: fixed steps, and never any input after the start. The
 * runner is held above the track so the whole stretch is generated instead of
 * ending at the first cactus — what is pinned here is the generator.
 */
function runBlind(seed: string, ms: number): { state: GameState; track: string } {
  let state = jump(createInitialState(seed));
  const spawned: string[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    const before = state.obstacles.length;
    state = step({ ...state, status: 'running', runnerY: 300 }, STEP_MS);
    for (let i = before; i < state.obstacles.length; i++) {
      const fresh = state.obstacles[i]!;
      spawned.push(`${fresh.kindId}@${fresh.spawnDistance.toFixed(1)}`);
    }
  }
  return { state, track: spawned.join('|') };
}

describe('tracks that must never change', () => {
  it("the opening of seed 'dino-golden' is unchanged", () => {
    expect(runBlind('dino-golden', 12_000).track).toBe(
      'cactus-small@216.0|cactus-tall@544.5|cactus-pair@921.9|cactus-pair@1173.4|' +
        'cactus-small@1483.0|cactus-tall@1710.5|cactus-small@2105.5|cactus-pair@2500.0|' +
        'cactus-pair@2759.5',
    );
  });

  it('the same seed a minute in is unchanged', () => {
    const { state } = runBlind('dino-golden', 60_000);
    expect(`${state.score}/${state.obstaclesPassed}/${state.speed.toFixed(1)}`).toBe(
      '1191/45/460.0',
    );
  });
});
