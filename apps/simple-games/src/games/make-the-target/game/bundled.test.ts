// @vitest-environment node
/**
 * The bundled problems of docs/MAKE_THE_TARGET_RULES.md §6「同梱の問題」,
 * proven rather than trusted (§15「同梱」): the table is exactly what the
 * generator makes from its recorded seeds, each problem is re-counted by the
 * memo-free walk and meets its tier by the one predicate (a bundled problem
 * carries no ÷-round branch), its solution replays legally to the target,
 * its counts are the ones the fallback reports, and no two repeat.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_PER_TIER, BUNDLED_PROBLEMS } from './bundled';
import { replay } from './engine';
import { bundledFor, problemOfBundled } from './generator';
import { decodeMoves } from './serialize';
import { bundledSeeds, countsFor, intermediateBound, plainCounts } from './test-helpers';
import { meetsTier } from './tiers';
import { DIFFICULTIES } from './types';

describe('bundled problems (§6)', () => {
  it(`holds ${BUNDLED_PER_TIER} per tier, ${BUNDLED_PER_TIER * 3} in all, none repeated`, () => {
    const keys = new Set<string>();
    for (const difficulty of DIFFICULTIES) {
      expect(BUNDLED_PROBLEMS[difficulty]).toHaveLength(BUNDLED_PER_TIER);
      for (const p of BUNDLED_PROBLEMS[difficulty])
        keys.add(`${difficulty}:${p.numbers}=${p.target}`);
    }
    expect(keys.size).toBe(72);
  });

  for (const difficulty of DIFFICULTIES) {
    it(
      `${difficulty}: the table is what the generator makes from its seeds`,
      { timeout: 60_000 },
      () => {
        const { rows, skipped } = bundledSeeds(difficulty);
        console.log(
          `[make-the-target] bundled ${difficulty}: seeds 1–${rows.at(-1)!.k}, skipped ${
            skipped.length === 0 ? 'none' : skipped.map((s) => `${s.seed} (${s.reason})`).join(', ')
          }`,
        );
        expect(
          BUNDLED_PROBLEMS[difficulty].map(
            ({ seed, numbers, target, solution, ways, waysWithoutDivision }) => ({
              seed,
              made: { numbers, target, solution, ways, waysWithoutDivision },
            }),
          ),
        ).toEqual(rows.map(({ seed, made }) => ({ seed, made })));
      },
    );

    it(`${difficulty}: every problem is re-counted, meets its tier and replays its solution`, () => {
      for (const entry of BUNDLED_PROBLEMS[difficulty]) {
        const recounted = plainCounts(entry.numbers);
        const counts = countsFor(recounted, entry.target);
        expect(counts, entry.seed).toEqual({
          ways: entry.ways,
          waysWithoutDivision: entry.waysWithoutDivision,
        });
        expect(meetsTier(difficulty, entry.numbers, entry.target, counts), entry.seed).toBe(true);
        expect(recounted.maxValue).toBeLessThanOrEqual(intermediateBound(entry.numbers));
        const solution = decodeMoves(entry.solution, entry.numbers.length - 1)!;
        expect(solution, entry.seed).toHaveLength(entry.numbers.length - 1);
        const replayed = replay(entry.numbers, solution)!;
        expect(
          replayed.slots.filter((v) => v !== null),
          entry.seed,
        ).toEqual([entry.target]);
        expect(problemOfBundled(entry, difficulty)).toEqual({
          difficulty,
          numbers: entry.numbers,
          target: entry.target,
          solution,
        });
      }
    });
  }

  it('the fallback picks by the seed, the same one every time, and reaches every row', () => {
    expect(bundledFor('some-seed', 'hard')).toBe(bundledFor('some-seed', 'hard'));
    const picked = new Set(
      Array.from({ length: 400 }, (_, i) => bundledFor(`pick-${i}`, 'medium').seed),
    );
    expect(picked.size).toBe(BUNDLED_PER_TIER);
  });
});
