/**
 * Auto-play quality measurement, the greedy player (docs/GEM_SWAP_RULES.md §14).
 * The method and the gates are in autoplay-helpers.ts.
 */
import { describe, it } from 'vitest';
import { ROUNDS, chunkRanges, emptyMeasured, playChunk, reportAndCheck } from './autoplay-helpers';

for (const colors of [5, 6] as const) {
  describe(`auto-play greedy, ${colors} colours, ${ROUNDS} seeds`, () => {
    const measured = emptyMeasured();
    for (const [from, to] of chunkRanges()) {
      it(`seeds ${from}–${to - 1}`, () => {
        playChunk('greedy', colors, from, to, measured);
      });
    }
    it('all seeds: report and check', () => {
      reportAndCheck('greedy', colors, measured);
    });
  });
}
