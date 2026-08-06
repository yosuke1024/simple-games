/**
 * Golden boards: the opening deal for one seed, and where a fixed sequence of
 * moves leaves it.
 *
 * A best score is a promise. The record on the statistics screen was set on
 * boards this rng produced, and it only means something if the same seed still
 * deals the same game — the spawn draw is also what Undo rests on (§5, §6), so
 * a change here quietly turns a help into a reroll. Any change to the rng, to
 * the order of the draws, or to the 10% rate will fail here, which is the
 * point: it costs every player their recorded bests, so it has to be a
 * decision rather than a side effect.
 *
 * This pins released behaviour; do not edit these strings to go green. If a
 * change is intended, regenerate them and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { encodeBoard } from './serialize';
import { applyMove, createSession } from './session';
import { SPAWN_FOUR_CHANCE, type Direction } from './types';

const SEED = '2048-golden';

/** A short game whose every move changes the board for this seed. */
const SEQUENCE: readonly Direction[] = ['left', 'up', 'right', 'down', 'left'];

describe('boards that must never change', () => {
  it('deals the same opening for its seed', () => {
    const session = createSession(SEED);
    // Row-major, one base-36 exponent per cell; '0' is an empty square:
    //   .  .  .  .
    //   .  .  .  .
    //   2  2  .  .
    //   .  .  .  .
    expect(encodeBoard(session.board)).toBe('0000000001100000');
    expect(session.spawnIndex).toBe(2);
  });

  it('reaches the same position after a fixed sequence of moves', () => {
    let session = createSession(SEED);
    for (const direction of SEQUENCE) {
      const outcome = applyMove(session, direction);
      expect(outcome, `${direction} did nothing`).not.toBeNull();
      session = outcome!.session;
    }
    //   .  .  .  .
    //   2  .  .  .
    //   2  .  .  .
    //   2  8  4  .
    expect(encodeBoard(session.board)).toBe('0000100010001320');
    expect(session.score).toBe(12);
    expect(session.spawnIndex).toBe(2 + SEQUENCE.length);
  });

  it('draws a 4 one time in ten', () => {
    // Named here as well as in types.ts: this is the number the boards above
    // were generated under, and changing it changes every one of them.
    expect(SPAWN_FOUR_CHANCE).toBe(0.1);
  });
});
