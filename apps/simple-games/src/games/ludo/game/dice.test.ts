/**
 * The die: uniform across a wide sweep of seeds and rolls, unbiased between
 * seats, and pinned exactly for one seed so a saved match's dice never
 * silently change under it.
 *
 * The uniformity and seat-bias checks are sized by how many rolls they make
 * — tens of thousands — not by a clock, so they run in whatever time that
 * takes and stay meaningful regardless of machine speed.
 */
import { describe, expect, it } from 'vitest';
import { rollFor } from './dice';

/** Rolls `count` dice for `seed`, starting at roll index 0. */
function rollMany(seed: string, count: number): number[] {
  const rolls: number[] = [];
  for (let index = 0; index < count; index++) rolls.push(rollFor(seed, index));
  return rolls;
}

describe('rollFor is uniform', () => {
  it('every face comes up close to equally often across many seeds and rolls', () => {
    const seeds = 30;
    const rollsPerSeed = 2000;
    const counts = [0, 0, 0, 0, 0, 0, 0]; // index 0 unused; faces are 1..6
    let total = 0;
    for (let seedIndex = 0; seedIndex < seeds; seedIndex++) {
      for (const die of rollMany(`ludo-uniform-${seedIndex}`, rollsPerSeed)) {
        counts[die]! += 1;
        total += 1;
      }
    }

    expect(total).toBe(seeds * rollsPerSeed);
    const expectedPerFace = total / 6;
    // A fair die over 60,000 rolls should land within a few percent of even
    // on every face; this bound is generous enough to be quiet on a good
    // PRNG and loud on a biased one.
    const tolerance = expectedPerFace * 0.1;
    for (let face = 1; face <= 6; face++) {
      expect(counts[face], `face ${face} count`).toBeGreaterThan(expectedPerFace - tolerance);
      expect(counts[face], `face ${face} count`).toBeLessThan(expectedPerFace + tolerance);
    }
  });
});

describe('rollFor does not favor any seat', () => {
  it('splitting one long sequence into four interleaved seats shows no bias between them', () => {
    // rollIndex only ever counts rolls made, the same sequence regardless of
    // whose turn it is (design doc §A) — so bucketing by rollIndex % 4
    // stands in for "which seat this roll would typically belong to" in an
    // ordinary four-seat match, without needing the engine's turn order
    // here at all.
    const rollCount = 40_000;
    const bucketTotals = [0, 0, 0, 0];
    const bucketCounts = [0, 0, 0, 0];
    for (let index = 0; index < rollCount; index++) {
      const die = rollFor('ludo-seat-bias', index);
      const bucket = index % 4;
      bucketTotals[bucket]! += die;
      bucketCounts[bucket]! += 1;
    }

    const means = bucketTotals.map((total, bucket) => total / bucketCounts[bucket]!);
    const expectedMean = 3.5; // (1 + 2 + 3 + 4 + 5 + 6) / 6
    for (const [bucket, mean] of means.entries()) {
      expect(mean, `bucket ${bucket} mean`).toBeGreaterThan(expectedMean - 0.15);
      expect(mean, `bucket ${bucket} mean`).toBeLessThan(expectedMean + 0.15);
    }
    // No bucket should be noticeably ahead of another, which a per-seat bias
    // in the derivation would produce.
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.2);
  });
});

describe('a golden sequence', () => {
  it("the first forty rolls of seed 'ludo-golden' are unchanged", () => {
    // If this fails, the thing to fix is the implementation, not the
    // expectation. `rollFor` feeds a saved match's replay (docs/plans/
    // 2026-08-08-mahjong-bubble-ludo.md §C.3); changing the derivation
    // string, the RNG, or the scaling here moves every future dice sequence
    // out from under matches already saved. Regenerating this list is a
    // decision to make and state in the commit message, not a fix.
    expect(rollMany('ludo-golden', 40)).toEqual([
      1, 5, 1, 5, 3, 6, 4, 3, 6, 5, 1, 3, 5, 4, 2, 3, 2, 4, 4, 4, 1, 4, 6, 3, 1, 2, 3, 1, 1, 4, 3,
      5, 1, 4, 3, 3, 1, 3, 4, 2,
    ]);
  });
});
