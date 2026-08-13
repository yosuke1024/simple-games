/**
 * `MAX_ROLLS` (engine.ts) is pinned from a self-play sweep, not a guess —
 * see the comment on the constant itself for the full numbers: 3 difficulties
 * x 2,000 seeds each, every match played out with `MAX_ROLLS` temporarily
 * raised far past any real match length so nothing was cut off mid-sweep.
 * That full sweep is not what runs here: 6,000 matches is real work, and
 * this file has to stay fast on every CI run, not just be run once by hand.
 *
 * What this file re-checks, on a much smaller sweep sized as a constant
 * (`SEEDS_PER_DIFFICULTY`, work-bounded rather than clock-bounded, per the
 * design doc's "the gate is work, not a wall clock" rule in §C.4) is that
 * the shape the full sweep found has not moved: every match still decides
 * (no no-contest), and the longest match seen is still well inside the cap
 * — under half of it, with room to spare for a smaller sample's higher
 * variance. If a change to the rules or the CPU ever pushed real matches
 * roughly `MAX_ROLLS / 2` rolls long, this is what would catch it long
 * before the cap itself started cutting real matches short.
 */
import { describe, expect, it } from 'vitest';
import { buildLudoView, chooseCpuMove } from './cpu';
import { applyMove, initialState, MAX_ROLLS, rollDie } from './engine';
import { createRng } from './rng';
import { DIFFICULTIES, type Difficulty } from './types';

/** Seeds swept per difficulty here. The full sweep (2,000/difficulty) lives in docs, not in code. */
const SEEDS_PER_DIFFICULTY = 300;

/**
 * Plays one match to a decision, every seat — including seat 0 — driven by
 * `chooseCpuMove` at `difficulty`. The same `rollIndex` seeds both the die
 * and, when a move is needed, the CPU tie-break for that same roll, exactly
 * as the design doc's replay shape (§C.3) has session.ts do it later.
 */
interface PlayedMatch {
  readonly rolls: number;
  readonly noContest: boolean;
}

function playOne(seed: string, difficulty: Difficulty): PlayedMatch {
  let state = initialState();
  while (state.result === null) {
    const rollIndexForThisRoll = state.rollIndex;
    const outcome = rollDie(state, seed);
    if (outcome === null) throw new Error(`rollDie returned null mid-match (seed ${seed})`);
    state = outcome.state;
    if (outcome.kind === 'move') {
      const view = buildLudoView(state, difficulty)!;
      const tieBreak = createRng(`${seed}:cpu:${rollIndexForThisRoll}`)();
      const move = chooseCpuMove(view, tieBreak)!;
      state = applyMove(state, move)!;
    }
  }
  return { rolls: state.rollIndex, noContest: state.result.kind === 'noContest' };
}

describe('roll counts stay well inside the cap', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: ${SEEDS_PER_DIFFICULTY} self-played matches all decide, comfortably under the cap`, () => {
      let maxRolls = 0;
      let noContestCount = 0;
      for (let index = 0; index < SEEDS_PER_DIFFICULTY; index++) {
        const seed = `ludo-roll-distribution-${difficulty}-${index}`;
        const played = playOne(seed, difficulty);
        maxRolls = Math.max(maxRolls, played.rolls);
        if (played.noContest) noContestCount += 1;
      }
      // No fixture here ever hits the cap itself — a match reaching
      // MAX_ROLLS ends in a no-contest (§2.9), and none of this sweep's
      // matches should. If one ever does, that is the signal to re-run the
      // full sweep and reconsider MAX_ROLLS, not to raise this bound.
      expect(noContestCount, `${difficulty}: no-contests in this sweep`).toBe(0);
      expect(
        maxRolls,
        `${difficulty}: longest match (${maxRolls} rolls) should stay under MAX_ROLLS / 2 (${MAX_ROLLS / 2})`,
      ).toBeLessThan(MAX_ROLLS / 2);
    });
  }
});
