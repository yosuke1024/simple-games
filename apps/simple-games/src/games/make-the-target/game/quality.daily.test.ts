// @vitest-environment node
/**
 * docs/MAKE_THE_TARGET_RULES.md §15「生成」, the Daily Challenge: 365 days
 * from 2026-10-21 — the exact problems every player will see on those days,
 * walked rather than sampled — each checked by test-helpers.ts `walkSeeds`
 * like the Free Play tiers (Medium every day, §8).
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, DAILY_DIFFICULTY } from './daily';
import { dailyProblem } from './generator';
import { describeWalk, summarizeWalk, walkSeeds } from './test-helpers';

const FIRST_DAY = '2026-10-21';
const DAYS = Array.from({ length: 365 }, (_, i) => addDays(FIRST_DAY, i)!);

/** A walk, not a unit check: generous for a loaded machine, and never a speed gate. */
const WALK_TIMEOUT = 60_000;

describe('the daily: 365 days (§8, §15)', () => {
  it(
    'every day is a Medium problem that meets its tier and replays its solution',
    { timeout: WALK_TIMEOUT },
    () => {
      const report = walkSeeds(DAILY_DIFFICULTY, DAYS.map(dailySeed));
      console.log(describeWalk(`daily ${FIRST_DAY} + 364 days`, report).join('\n'));
      expect(report.failures).toEqual([]);
      expect(new Set(DAYS).size).toBe(365);
      // Nothing reached WORK_LIMIT: §6 step 7 and §7 state 0, and WORK_LIMIT
      // rests on it. A fallback ships a bundled problem that meets the tier,
      // so the checks above would pass without this line.
      const summary = summarizeWalk(report);
      expect(summary.fallbacks).toBe(0);
      expect(report.problems.filter((p) => p.generated.fallback)).toEqual([]);
      // The distributions §7's table quotes — deterministic, so pinned.
      expect(summary).toEqual({
        fallbacks: 0,
        ways: [2, 13, 149, 200],
        divisionRequired: 118,
        divisionRequiredWays: [1, 4, 36, 156],
        divisionRounds: 106,
        tiles: { 4: 200, 5: 165 },
        attempts: [5, 175, 318],
        work: [831, 19_537, 29_208],
        worstCount: 1_427,
        largest: 45_000,
      });
    },
  );

  it('is the same problem for the same date', () => {
    expect(dailyProblem('2027-02-28')).toEqual(dailyProblem('2027-02-28'));
    expect(dailyProblem('2027-02-28').problem).not.toEqual(dailyProblem('2027-03-01').problem);
  });
});
