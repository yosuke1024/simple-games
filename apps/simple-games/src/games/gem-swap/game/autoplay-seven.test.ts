/**
 * Auto-play quality measurement over seven kinds (docs/GEM_SWAP_RULES.md §2,
 * §14, §15). Seven kinds are not in v1; this measures the same two players
 * over the same seeds so the owner can decide with numbers. The method and
 * the gates are in autoplay-helpers.ts (see SEVEN there).
 */
import { describe, it } from 'vitest';
import {
  ROUNDS,
  SEVEN,
  chunkRanges,
  emptyMeasured,
  playChunk,
  reportAndCheck,
  type Policy,
} from './autoplay-helpers';

for (const policy of ['random', 'greedy'] as const satisfies readonly Policy[]) {
  describe(`auto-play ${policy}, ${SEVEN} colours (measurement only), ${ROUNDS} seeds`, () => {
    const measured = emptyMeasured();
    for (const [from, to] of chunkRanges()) {
      it(`seeds ${from}–${to - 1}`, () => {
        playChunk(policy, SEVEN, from, to, measured);
      });
    }
    it('all seeds: report and check', () => {
      reportAndCheck(policy, SEVEN, measured);
    });
  });
}
