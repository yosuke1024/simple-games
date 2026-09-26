/**
 * Golden secrets: the code each seed deals, at each difficulty
 * (docs/HIT_AND_BLOW_RULES.md §2).
 *
 * The secret is never written into a save — only the seed is, and the code
 * is dealt again on load (§8). So a suspended game only comes back as the
 * game that was left while the same seed still deals the same code: change
 * the shuffle, the rng, the pool order or the `:secret` suffix, and every
 * saved history is suddenly scored against a different answer.
 *
 * This pins released behaviour; do not edit these arrays to go green. If a
 * change to the deal is intended, it needs a save migration first, and the
 * commit says what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { judge, secretFor } from './engine';
import { type Difficulty } from './types';

const GOLDEN: Record<string, Record<Difficulty, number[]>> = {
  'hit-and-blow-golden-a': {
    easy: [2, 0, 3, 5],
    normal: [1, 3, 4, 0],
    hard: [1, 3, 4, 0, 5],
  },
  'hit-and-blow-golden-b': {
    easy: [2, 5, 4, 1],
    normal: [7, 4, 6, 3],
    hard: [7, 4, 6, 3, 1],
  },
};

describe('secrets that must never change', () => {
  for (const [seed, bySeed] of Object.entries(GOLDEN)) {
    for (const [difficulty, secret] of Object.entries(bySeed)) {
      it(`${seed} deals ${secret.join(',')} on ${difficulty}`, () => {
        expect(secretFor(seed, difficulty as Difficulty)).toEqual(secret);
      });
    }
  }

  it('scores a saved history the same way against the dealt code', () => {
    // A history as it sits in a save: the feedback is not stored, so it is
    // only what it was while the deal and the judge both hold still.
    const secret = secretFor('hit-and-blow-golden-a', 'normal');
    expect([
      judge(secret, [0, 1, 2, 3]),
      judge(secret, [4, 0, 1, 5]),
      judge(secret, [1, 3, 4, 0]),
    ]).toEqual([
      { hits: 0, blows: 3 },
      { hits: 0, blows: 3 },
      { hits: 4, blows: 0 },
    ]);
  });
});
