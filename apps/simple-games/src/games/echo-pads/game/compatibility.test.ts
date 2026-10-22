/**
 * Golden sequences (docs/ECHO_PADS_RULES.md §3). A saved run is rebuilt from
 * its seed (§8), so a generator that drifts would hand a restored run a
 * different sequence from the one the player was hearing. If this is red,
 * either a migration plan exists and this file changes in the same commit,
 * or the generator has drifted. Do not "fix" the expectation to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { dailySeed, DAILY_PAD_COUNT, DAILY_TARGET } from './daily';
import { levelSeed, levelSpec } from './levels';
import { generateSequence } from './sequence';
import { createDailySession, createLevelSession } from './session';

describe('generated sequences never drift (§3)', () => {
  it('pins the first and last level of each tier, and a retry', () => {
    expect({
      l1: createLevelSession(1, 0)!.sequence,
      l11: createLevelSession(11, 0)!.sequence,
      l12: createLevelSession(12, 0)!.sequence,
      l22: createLevelSession(22, 0)!.sequence,
      l22r1: createLevelSession(22, 1)!.sequence,
    }).toMatchInlineSnapshot(`
      {
        "l1": [
          1,
          3,
          0,
          1,
        ],
        "l11": [
          0,
          3,
          3,
          1,
          3,
          1,
          1,
          2,
          2,
          3,
          3,
          2,
          1,
          3,
        ],
        "l12": [
          5,
          1,
          4,
          5,
        ],
        "l22": [
          2,
          1,
          2,
          1,
          3,
          5,
          4,
          5,
          3,
          0,
          5,
          3,
          1,
          3,
        ],
        "l22r1": [
          2,
          1,
          4,
          1,
          3,
          3,
          2,
          4,
          5,
          1,
          2,
          1,
          3,
          2,
        ],
      }
    `);
  });

  it('pins a daily', () => {
    expect(createDailySession('2026-10-22', 0)!.sequence).toMatchInlineSnapshot(`
      [
        3,
        2,
        2,
        0,
        3,
        3,
        0,
        5,
        5,
        4,
      ]
    `);
  });

  it('pins sequences that needed more than one candidate, with their draw counts', () => {
    // The goldens above all pass on their first candidate, so they would not
    // notice a change in how a rejected candidate is replaced. These need 2,
    // 2, 7 (the most any level draws in §17's walk) and 2 candidates.
    const level = (n: number, attempt: number): string => {
      const spec = levelSpec(n)!;
      const g = generateSequence(levelSeed(n, attempt), spec.padCount, spec.target);
      expect(createLevelSession(n, attempt)!.sequence).toEqual(g.pads);
      return `${g.draws} draws: ${g.pads.join('')}`;
    };
    const daily = generateSequence(dailySeed('2026-10-29', 0), DAILY_PAD_COUNT, DAILY_TARGET);
    expect(createDailySession('2026-10-29', 0)!.sequence).toEqual(daily.pads);
    expect({
      l1r1: level(1, 1),
      l11r7: level(11, 7),
      l14r406: level(14, 406),
      daily20261029r0: `${daily.draws} draws: ${daily.pads.join('')}`,
    }).toMatchInlineSnapshot(`
      {
        "daily20261029r0": "2 draws: 5025342014",
        "l11r7": "2 draws: 13112330110330",
        "l14r406": "7 draws: 411332",
        "l1r1": "2 draws: 1012",
      }
    `);
  });
});
