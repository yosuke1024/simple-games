// @vitest-environment node
/**
 * docs/MAKE_THE_TARGET_RULES.md §15「全数」: every multiset of four numbers
 * from 1 to 10 (715 of them), counted three ways — the memoised `countWays`,
 * the tile-level oracle (every procedure over slots through engine.ts,
 * deduplicated by its value moves) and the memo-free value-level walk —
 * which must agree on `ways` and `waysWithoutDivision`: the two oracles on
 * every final value any procedure reaches, and `countWays` on each of those
 * values and on every target from 1 to 24 (which adds the targets nothing
 * reaches). The oracles share no code with `countWays`; they do share the
 * rules (engine.ts `applyMove` / `applyOperator`) with the game — the rules
 * themselves are engine.test.ts's. The same walk checks the bound of §1 on
 * the four-tile side: no intermediate value of any legal procedure passes
 * 10,000.
 *
 * Five tiles are too many for the tile-level oracle in bulk (737,280
 * tile-level procedures each); a fixed sample checks the memo-free walk
 * against it there, so that the 1,000-seed walks may lean on the cheaper one.
 */
import { describe, expect, it } from 'vitest';
import { createRng, randomInt } from './rng';
import { countWays } from './solver';
import { countsFor, plainCounts, slotLevelCounts, TIER_VALUE_BOUND } from './test-helpers';

/** Whether two final value → [ways, waysWithoutDivision] maps are the same. */
function sameCounts(
  a: ReadonlyMap<number, readonly [number, number]>,
  b: ReadonlyMap<number, readonly [number, number]>,
): boolean {
  if (a.size !== b.size) return false;
  for (const [value, [ways, without]] of a) {
    const other = b.get(value);
    if (other === undefined || other[0] !== ways || other[1] !== without) return false;
  }
  return true;
}

function multisets(size: number, min: number, max: number): number[][] {
  const out: number[][] = [];
  const grow = (prefix: number[], from: number) => {
    if (prefix.length === size) {
      out.push(prefix);
      return;
    }
    for (let v = from; v <= max; v++) grow([...prefix, v], v);
  };
  grow([], min);
  return out;
}

describe('four tiles, 1–10, every final value and every target 1–24 (§15「全数」)', () => {
  it(
    'countWays, the tile-level oracle and the memo-free walk agree on every value',
    { timeout: 60_000 },
    () => {
      const all = multisets(4, 1, 10);
      expect(all).toHaveLength(715);
      let compared = 0; // multiset × target 1–24
      let finalValues = 0; // multiset × final value, oracle against the memo-free walk
      let counted = 0; // countWays calls checked against the oracle
      let worstStates = 0;
      let largest = 0;
      let solvable = 0;
      const mismatches: string[] = [];
      for (const numbers of all) {
        const oracle = slotLevelCounts(numbers);
        const plain = plainCounts(numbers);
        largest = Math.max(largest, oracle.maxValue);
        if (plain.maxValue !== oracle.maxValue) mismatches.push(`${numbers} max`);
        // The memo-free walk against the oracle: the whole map, every final value.
        if (!sameCounts(plain.byValue, oracle.byValue)) mismatches.push(`${numbers}: plain`);
        finalValues += oracle.byValue.size;
        // countWays on every final value, and on 1–24 for the ones nothing reaches.
        const targets = new Set(oracle.byValue.keys());
        for (let target = 1; target <= 24; target++) {
          targets.add(target);
          if (countsFor(oracle, target).ways > 0) solvable++;
          compared++;
        }
        for (const target of targets) {
          const result = countWays(numbers, target, Infinity);
          if (result.capped) throw new Error('an unbounded count cannot cap');
          worstStates = Math.max(worstStates, result.states);
          const mine = { ways: result.ways, waysWithoutDivision: result.waysWithoutDivision };
          const fromOracle = countsFor(oracle, target);
          if (JSON.stringify(mine) !== JSON.stringify(fromOracle)) {
            mismatches.push(
              `${numbers}→${target}: ${JSON.stringify(mine)} vs ${JSON.stringify(fromOracle)}`,
            );
          }
          counted++;
        }
      }
      console.log(
        `[make-the-target] exhaustive 4 tiles: ${compared} problems (targets 1–24), ${solvable} solvable; ` +
          `${finalValues} final values compared between the oracles, ${counted} counts by countWays; ` +
          `worst count ${worstStates} states, largest intermediate ${largest}`,
      );
      expect(mismatches).toEqual([]);
      expect(compared).toBe(715 * 24);
      // Deterministic, and quoted in §1 / §6 / §15: a change here is a change to the rules.
      expect({ solvable, worstStates, largest, finalValues, counted }).toEqual({
        solvable: 13_872,
        worstStates: 131,
        largest: 10_000,
        finalValues: 49_095,
        counted: 52_383,
      });
      expect(largest).toBeLessThanOrEqual(TIER_VALUE_BOUND.easy);
    },
  );
});

describe('five tiles, a fixed sample (§15)', () => {
  it('the memo-free walk agrees with the tile-level oracle', { timeout: 60_000 }, () => {
    const rng = createRng('make-the-target-guarantee-5');
    const samples: number[][] = [];
    for (let i = 0; i < 6; i++) {
      const numbers = Array.from({ length: 5 }, () => randomInt(rng, 1, 10));
      if (i % 2 === 1) numbers[0] = randomInt(rng, 11, 25);
      samples.push(numbers.sort((a, b) => a - b));
    }
    for (const numbers of samples) {
      const oracle = slotLevelCounts(numbers);
      const plain = plainCounts(numbers);
      expect(plain.maxValue, String(numbers)).toBe(oracle.maxValue);
      expect(
        [...plain.byValue].sort((a, b) => a[0] - b[0]),
        String(numbers),
      ).toEqual([...oracle.byValue].sort((a, b) => a[0] - b[0]));
      // And countWays on a few of its targets.
      for (const target of [...oracle.byValue.keys()].filter((v) => v % 37 === 0)) {
        const counted = countWays(numbers, target, Infinity);
        expect(counted.capped ? null : [counted.ways, counted.waysWithoutDivision]).toEqual(
          oracle.byValue.get(target),
        );
      }
    }
    console.log(
      `[make-the-target] 5-tile sample: ${samples.length} multisets, every final value compared`,
    );
  });
});
