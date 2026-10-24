/**
 * Golden rounds: one pinned seed, exactly (docs/GEM_SWAP_RULES.md §4, §7).
 *
 * A seed is a promise. A suspended round stores only its seed, its colour
 * count and its swaps (§7), and reads the board back by replaying them; Undo
 * is a step back rather than a reroll because the same seed always deals the
 * same board and the same column tapes (§6). Any change to the rng, the
 * constructive generator, the attempt or tape keys, the refill order, or the
 * kind order will fail here — which is the point: it costs players the round
 * they left open, so it has to be a decision rather than a side effect.
 *
 * This pins released behaviour; do not edit it to go green. If a change here
 * is intended, regenerate the values and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { validSwaps } from './board';
import { createRound, replayRound, toRecord, trySwap } from './round';

const GOLDEN = {
  5: {
    initial: '2030202024431202120040123340401102242121023103244331411232101420',
    moves: [
      { swap: [6, 7], stages: 1, score: 3 },
      { swap: [3, 4], stages: 2, score: 6 },
      { swap: [13, 14], stages: 3, score: 9 },
    ],
    board: '2032241324431001120041203340421302242121023103244331411232101420',
    score: 18,
    tape: [0, 0, 0, 0, 1, 9, 3, 5],
  },
  6: {
    initial: '2040202035531213120050124450502202342121024203345441512143211520',
    moves: [
      { swap: [20, 21], stages: 1, score: 3 },
      { swap: [9, 10], stages: 2, score: 6 },
      { swap: [22, 23], stages: 2, score: 6 },
    ],
    board: '2003245334502010123312034410554102242022024203345441512143211520',
    score: 15,
    tape: [0, 0, 7, 1, 1, 1, 4, 1],
  },
} as const;

describe('rounds that must never change', () => {
  for (const colors of [5, 6] as const) {
    it(`seed "gem-swap-golden", ${colors} colours: the initial board and the first three moves`, () => {
      const golden = GOLDEN[colors];
      let round = createRound('gem-swap-golden', colors);
      expect(round.board.join('')).toBe(golden.initial);
      expect(round.bundled).toBe(false);
      for (const expected of golden.moves) {
        // The first valid swap in pair order each time.
        const [a, b] = validSwaps(round.board)[0]!;
        expect([a, b]).toEqual(expected.swap);
        const outcome = trySwap(round, a, b)!;
        expect(outcome.move.stages).toHaveLength(expected.stages);
        expect(outcome.move.score).toBe(expected.score);
        round = outcome.round;
      }
      expect(round.board.join('')).toBe(golden.board);
      expect(round.score).toBe(golden.score);
      expect(round.tape).toEqual(golden.tape);
      expect(replayRound(toRecord(round))).toEqual(round);
    });
  }
});
