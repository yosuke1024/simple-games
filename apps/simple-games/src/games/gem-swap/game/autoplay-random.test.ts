/**
 * Auto-play quality measurement, the random player (docs/GEM_SWAP_RULES.md §14).
 * The method and the gates are in autoplay-helpers.ts.
 */
import { describe, it } from 'vitest';
import { ROUNDS, chunkRanges, emptyMeasured, playChunk, reportAndCheck } from './autoplay-helpers';

for (const colors of [5, 6] as const) {
  describe(`auto-play random, ${colors} colours, ${ROUNDS} seeds`, () => {
    const measured = emptyMeasured();
    for (const [from, to] of chunkRanges()) {
      it(`seeds ${from}–${to - 1}`, () => {
        playChunk('random', colors, from, to, measured);
      });
    }
    it('all seeds: report and check', () => {
      reportAndCheck('random', colors, measured);
    });
  });
}
