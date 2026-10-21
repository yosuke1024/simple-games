// @vitest-environment node
/**
 * docs/MAKE_THE_TARGET_RULES.md §15「生成」, Easy: 1,000 fixed seeds
 * `make-the-target-easy-x<k>` (k = 1…1,000 — the seeds of the document's
 * prototype, so the two can be compared), each generated with the shipped
 * budget and checked by test-helpers.ts `walkSeeds` against the memo-free
 * re-count. Free Play seeds are minted at play time and cannot all be
 * walked; a fixed set stands in for them. The distributions are printed
 * and quoted in §7 / §15 as measured here, and pinned below.
 */
import { describe, expect, it } from 'vitest';
import { describeWalk, summarizeWalk, walkSeeds } from './test-helpers';

const SEEDS = Array.from({ length: 1_000 }, (_, i) => `make-the-target-easy-x${i + 1}`);

/** A walk, not a unit check: generous for a loaded machine, and never a speed gate. */
const WALK_TIMEOUT = 60_000;

describe('easy: 1,000 seeds (§7, §15)', () => {
  it(
    'every problem meets its tier, re-counted without a memo, and replays its solution',
    { timeout: WALK_TIMEOUT },
    () => {
      const report = walkSeeds('easy', SEEDS);
      console.log(describeWalk('easy', report).join('\n'));
      expect(report.failures).toEqual([]);
      expect(report.problems).toHaveLength(1_000);
      // Nothing reached WORK_LIMIT: §6 step 7 and §7 state 0, and WORK_LIMIT
      // rests on it. A fallback ships a bundled problem that meets the tier,
      // so the checks above would pass without this line.
      const summary = summarizeWalk(report);
      expect(summary.fallbacks).toBe(0);
      expect(report.problems.filter((p) => p.generated.fallback)).toEqual([]);
      // The distributions §7's table quotes — deterministic, so pinned.
      expect(summary).toEqual({
        fallbacks: 0,
        ways: [6, 18, 36, 66],
        divisionRequired: 0,
        divisionRequiredWays: [],
        divisionRounds: 0,
        tiles: { 4: 1_000 },
        attempts: [3, 16, 24],
        work: [87, 197, 248],
        worstCount: 131,
        largest: 7_290,
      });
    },
  );
});
