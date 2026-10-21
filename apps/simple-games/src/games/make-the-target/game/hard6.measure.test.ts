// @vitest-environment node
/**
 * A measurement with its numbers pinned (docs/MAKE_THE_TARGET_RULES.md §7
 * 「Hard の 6 枚」, §15, §17 ①). Nothing ships six tiles; this exists because
 * the reason v1's Hard deals five rests on what it measures, so the numbers
 * the document quotes are asserted — they are deterministic (fixed seeds,
 * the shipped code), and a change to the generator, the solver or the tier
 * that moves them must also revisit that reason. v1's Hard deals five tiles,
 * and the document's reason for not dealing six came from a prototype whose
 * 298 / 300 fallbacks mixed two things: how rare a six-tile problem with
 * `ways` ≤ 40 is, and how fast six-tile counts spend a 50,000 budget. This
 * measures the two apart, with the shipped code (generator.ts
 * `searchProblem`, `buildSolution`, solver.ts `countWays`):
 *
 * (a) rarity — six-tile candidates whose built target lands in Hard's band,
 *     each counted with a budget no count reaches: the share with
 *     1 ≤ `ways` ≤ 40 and the `ways` distribution;
 * (b) cost — the states one count expands, and so how many counts fit in
 *     WORK_LIMIT;
 * (c) the two together — the shipped attempt loop with a six-tile shape and
 *     Hard's acceptance, over fixed seeds, at WORK_LIMIT: how many fall back.
 */
import { describe, expect, it } from 'vitest';
import { buildSolution, drawNumbers, searchProblem, WORK_LIMIT } from './generator';
import { createRng } from './rng';
import { countWays } from './solver';
import { percentile } from './test-helpers';
import { HARD_WAYS_MAX, TIERS, type TierSpec } from './tiers';

const SIX: TierSpec = { ...TIERS.hard, tileCounts: [6] };
const CANDIDATES = 300;
const SEEDS = 100;
/** No six-tile count measured comes near it. */
const UNBOUNDED = 10_000_000;
/** A bound on the draws for (a): the run below needs 875. */
const MAX_DRAWS = 100_000;

const q = (values: number[]) =>
  `p10 ${percentile(values, 10)} / p50 ${percentile(values, 50)} / p90 ${percentile(values, 90)} / max ${Math.max(...values)}`;

describe('six-tile Hard, measured (§7)', () => {
  it(
    'measures rarity, cost and fallbacks apart, at the values §7 quotes',
    { timeout: 120_000 },
    () => {
      // (a) and (b)
      const ways: number[] = [];
      const states: number[] = [];
      let drawn = 0;
      for (let k = 0; ways.length < CANDIDATES; k++) {
        if (k >= MAX_DRAWS)
          throw new Error(`fewer than ${CANDIDATES} candidates in ${MAX_DRAWS} draws`);
        const rng = createRng(`make-the-target-hard6-a-${k}`);
        const numbers = drawNumbers(rng, SIX);
        const { value } = buildSolution(rng, numbers, SIX.buildOperators, false);
        drawn++;
        if (value < SIX.targetRange[0] || value > SIX.targetRange[1]) continue;
        const counted = countWays(numbers, value, UNBOUNDED);
        if (counted.capped) throw new Error('UNBOUNDED was reached');
        ways.push(counted.ways);
        states.push(counted.states);
      }
      const hits = ways.filter((w) => w >= 1 && w <= HARD_WAYS_MAX).length;
      const meanStates = states.reduce((a, b) => a + b, 0) / states.length;

      // (c)
      let fallbacks = 0;
      const work: number[] = [];
      for (let k = 1; k <= SEEDS; k++) {
        const found = searchProblem(
          `make-the-target-hard6-c-${k}`,
          SIX,
          (_numbers, _target, counts) => counts.ways >= 1 && counts.ways <= HARD_WAYS_MAX,
          WORK_LIMIT,
          false,
        );
        work.push(found.work);
        if (!('moves' in found)) fallbacks++;
      }

      console.log(
        [
          `[make-the-target] six-tile Hard (measured; not shipped):`,
          `  (a) ${CANDIDATES} candidates in the band (of ${drawn} drawn): ${hits} with 1 ≤ ways ≤ ${HARD_WAYS_MAX} (${((100 * hits) / CANDIDATES).toFixed(1)}%)`,
          `      ways ${q(ways)}`,
          `  (b) states per count ${q(states)}, mean ${meanStates.toFixed(0)}; about ${Math.floor(WORK_LIMIT / meanStates)} counts fit in ${WORK_LIMIT}`,
          `  (c) ${SEEDS} seeds at WORK_LIMIT: ${fallbacks} fell back; work ${q(work)}`,
        ].join('\n'),
      );
      expect(ways).toHaveLength(CANDIDATES);
      expect(work.every((w) => w <= WORK_LIMIT)).toBe(true);
      // The values §7 and §17 quote — deterministic, so pinned.
      expect({
        drawn,
        hits,
        ways: [10, 50, 90, 100].map((p) => percentile(ways, p)),
        states: [10, 50, 90, 100].map((p) => percentile(states, p)),
        meanStates: Math.round(meanStates),
        countsFit: Math.floor(WORK_LIMIT / meanStates),
        fallbacks,
      }).toEqual({
        drawn: 875,
        hits: 0,
        ways: [360, 1_217, 2_899, 8_040],
        states: [5_232, 10_823, 17_307, 23_456],
        meanStates: 10_910,
        countsFit: 4,
        fallbacks: 99,
      });
    },
  );
});
