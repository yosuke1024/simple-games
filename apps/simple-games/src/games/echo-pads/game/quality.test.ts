// @vitest-environment node
/**
 * docs/ECHO_PADS_RULES.md §3 / §17: the bias cap is a pass rate, not an
 * invariant, so it is measured here — every level × attempts 0..499 and a
 * year of dailies × attempts 0..2 — and the numbers §17 quotes are pinned.
 * The generator is deterministic, so these are exact, not samples that drift.
 */
import { describe, expect, it } from 'vitest';
import { DAILY_PAD_COUNT, DAILY_TARGET, dailySeed, localDateString } from './daily';
import { LEVELS, levelSeed } from './levels';
import { breaksLocalRules, GEN_DRAW_LIMIT, generateSequence } from './sequence';
import { FIRST_ROUND } from './levels';
import type { PadCount } from './types';

const ATTEMPTS = 500;
const DAILY_ATTEMPTS = 3;
const FIRST_DAY = '2026-10-22';
const DAYS = Array.from({ length: 365 }, (_, i) => {
  const [y, m, d] = FIRST_DAY.split('-').map(Number) as [number, number, number];
  return localDateString(new Date(y, m - 1, d + i));
});

interface Walk {
  sequences: number;
  firstDraw: number;
  fallbacks: number;
  maxDraws: number;
  candidates: number;
  /** Prefix length → how many prefixes use n distinct pads (index n). */
  prefixDistinct: Record<number, number[]>;
  localRuleBreaks: number;
}

function newWalk(): Walk {
  return {
    sequences: 0,
    firstDraw: 0,
    fallbacks: 0,
    maxDraws: 0,
    candidates: 0,
    prefixDistinct: { 3: [0, 0, 0, 0], 4: [0, 0, 0, 0, 0], 5: [0, 0, 0, 0, 0, 0] },
    localRuleBreaks: 0,
  };
}

function visit(walk: Walk, seed: string, padCount: PadCount, length: number): void {
  const g = generateSequence(seed, padCount, length);
  walk.sequences += 1;
  walk.candidates += g.draws;
  if (g.draws === 1) walk.firstDraw += 1;
  if (g.fallback) walk.fallbacks += 1;
  walk.maxDraws = Math.max(walk.maxDraws, g.draws);
  if (breaksLocalRules(g.pads, padCount)) walk.localRuleBreaks += 1;
  for (const k of [3, 4, 5]) {
    if (k > length) continue;
    const distinct = new Set(g.pads.slice(0, k)).size;
    walk.prefixDistinct[k]![distinct]! += 1;
  }
}

/** What §17 quotes: deterministic, so pinned exactly. */
function summary(w: Walk): Record<string, number | number[]> {
  return {
    sequences: w.sequences,
    candidates: w.candidates,
    firstDraw: w.firstDraw,
    fallbacks: w.fallbacks,
    maxDraws: w.maxDraws,
    prefix3: w.prefixDistinct[3]!,
    prefix4: w.prefixDistinct[4]!,
    prefix5: w.prefixDistinct[5]!,
  };
}

const pct = (n: number, d: number): string => `${((100 * n) / d).toFixed(2)}%`;

function describeWalk(label: string, w: Walk): string {
  return [
    `${label}: ${w.sequences} sequences, ${w.candidates} candidates`,
    `  first candidate passed: ${w.firstDraw} (${pct(w.firstDraw, w.sequences)}); per-candidate pass ${pct(w.sequences - w.fallbacks, w.candidates)}`,
    `  fallbacks: ${w.fallbacks}; most draws: ${w.maxDraws} of ${GEN_DRAW_LIMIT}`,
    `  prefix k=3 distinct pads [0..3]: ${w.prefixDistinct[3]!.join(' / ')}`,
    `  prefix k=4 distinct pads [0..4]: ${w.prefixDistinct[4]!.join(' / ')}`,
    `  prefix k=5 distinct pads [0..5]: ${w.prefixDistinct[5]!.join(' / ')}`,
  ].join('\n');
}

describe('generation quality (§3, §17)', () => {
  it('walks every level × attempts 0..499', { timeout: 60_000 }, () => {
    const byTier: Record<PadCount, Walk> = { 4: newWalk(), 6: newWalk() };
    const perLevel: string[] = [];
    // Wall clock is printed, never asserted (docs/GAME_LIFECYCLE.md「CPU 探索」).
    const started = performance.now();
    for (const spec of LEVELS) {
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        generateSequence(levelSeed(spec.level, attempt), spec.padCount, spec.target);
      }
    }
    const elapsed = performance.now() - started;
    console.log(
      `wall clock: ${22 * ATTEMPTS} sequences in ${elapsed.toFixed(1)} ms (${((1000 * elapsed) / (22 * ATTEMPTS)).toFixed(1)} µs each)`,
    );
    for (const spec of LEVELS) {
      const w = newWalk();
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        visit(w, levelSeed(spec.level, attempt), spec.padCount, spec.target);
        visit(byTier[spec.padCount], levelSeed(spec.level, attempt), spec.padCount, spec.target);
      }
      perLevel.push(
        `L${spec.level} (${spec.padCount}p, ${spec.target}): first ${pct(w.firstDraw, w.sequences)}, fallbacks ${w.fallbacks}, max draws ${w.maxDraws}`,
      );
      expect(w.localRuleBreaks).toBe(0);
    }
    console.log(perLevel.join('\n'));
    console.log(describeWalk('4 pads, levels 1-11', byTier[4]));
    console.log(describeWalk('6 pads, levels 12-22', byTier[6]));
    expect(byTier[4].sequences + byTier[6].sequences).toBe(22 * ATTEMPTS);
    expect({ pads4: summary(byTier[4]), pads6: summary(byTier[6]) }).toMatchInlineSnapshot(`
      {
        "pads4": {
          "candidates": 5771,
          "fallbacks": 0,
          "firstDraw": 5251,
          "maxDraws": 3,
          "prefix3": [
            0,
            0,
            3819,
            1681,
          ],
          "prefix4": [
            0,
            0,
            1888,
            3134,
            478,
          ],
          "prefix5": [
            0,
            0,
            865,
            3011,
            1124,
            0,
          ],
          "sequences": 5500,
        },
        "pads6": {
          "candidates": 6412,
          "fallbacks": 0,
          "firstDraw": 4769,
          "maxDraws": 7,
          "prefix3": [
            0,
            0,
            2426,
            3074,
          ],
          "prefix4": [
            0,
            0,
            621,
            3334,
            1545,
          ],
          "prefix5": [
            0,
            0,
            119,
            1823,
            2572,
            486,
          ],
          "sequences": 5500,
        },
      }
    `);
  });

  it('walks a year of dailies × attempts 0..2', { timeout: 60_000 }, () => {
    const w = newWalk();
    for (const day of DAYS) {
      for (let attempt = 0; attempt < DAILY_ATTEMPTS; attempt++) {
        visit(w, dailySeed(day, attempt), DAILY_PAD_COUNT, DAILY_TARGET);
      }
    }
    console.log(describeWalk(`daily ${FIRST_DAY} + 364 days × r0..r2`, w));
    expect(w.sequences).toBe(365 * DAILY_ATTEMPTS);
    expect(w.localRuleBreaks).toBe(0);
    expect(summary(w)).toMatchInlineSnapshot(`
      {
        "candidates": 1166,
        "fallbacks": 0,
        "firstDraw": 1030,
        "maxDraws": 4,
        "prefix3": [
          0,
          0,
          498,
          597,
        ],
        "prefix4": [
          0,
          0,
          155,
          625,
          315,
        ],
        "prefix5": [
          0,
          0,
          35,
          446,
          504,
          110,
        ],
        "sequences": 1095,
      }
    `);
  });

  it('measures the cap §3 dropped, ceil(L / P) + 1, on the same walks', { timeout: 60_000 }, () => {
    // §3: the first cap was the fair share rounded up, plus one. It is not the
    // rule; this walk only keeps the numbers §3 gives for dropping it honest.
    const oldCap = (length: number, padCount: PadCount): number => Math.ceil(length / padCount) + 1;
    const firstDraw = { pads4: 0, pads6: 0, daily: 0 };
    const perLevel: string[] = [];
    const rejectedByLevel: Record<string, number> = {};
    for (const spec of LEVELS) {
      let first = 0;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const cap = oldCap(spec.target, spec.padCount);
        const g = generateSequence(levelSeed(spec.level, attempt), spec.padCount, spec.target, cap);
        if (g.draws === 1) first += 1;
      }
      firstDraw[spec.padCount === 4 ? 'pads4' : 'pads6'] += first;
      rejectedByLevel[`L${spec.level}`] = ATTEMPTS - first;
      perLevel.push(
        `L${spec.level} (${spec.padCount}p, ${spec.target}): first candidate rejected ${pct(ATTEMPTS - first, ATTEMPTS)}`,
      );
    }
    for (const day of DAYS) {
      for (let attempt = 0; attempt < DAILY_ATTEMPTS; attempt++) {
        const cap = oldCap(DAILY_TARGET, DAILY_PAD_COUNT);
        const g = generateSequence(dailySeed(day, attempt), DAILY_PAD_COUNT, DAILY_TARGET, cap);
        if (g.draws === 1) firstDraw.daily += 1;
      }
    }
    console.log(
      [
        'cap ceil(L/P)+1, first candidate passed:',
        `  4 pads ${firstDraw.pads4} / ${11 * ATTEMPTS} (${pct(firstDraw.pads4, 11 * ATTEMPTS)})`,
        `  6 pads ${firstDraw.pads6} / ${11 * ATTEMPTS} (${pct(firstDraw.pads6, 11 * ATTEMPTS)})`,
        `  daily ${firstDraw.daily} / ${365 * DAILY_ATTEMPTS} (${pct(firstDraw.daily, 365 * DAILY_ATTEMPTS)})`,
        ...perLevel,
      ].join('\n'),
    );
    expect({ firstDraw, rejectedByLevel }).toMatchInlineSnapshot(`
      {
        "firstDraw": {
          "daily": 719,
          "pads4": 3987,
          "pads6": 3912,
        },
        "rejectedByLevel": {
          "L1": 78,
          "L10": 138,
          "L11": 193,
          "L12": 32,
          "L13": 83,
          "L14": 166,
          "L15": 33,
          "L16": 79,
          "L17": 108,
          "L18": 205,
          "L19": 246,
          "L2": 12,
          "L20": 324,
          "L21": 129,
          "L22": 183,
          "L3": 48,
          "L4": 124,
          "L5": 204,
          "L6": 79,
          "L7": 147,
          "L8": 219,
          "L9": 271,
        },
      }
    `);
  });

  it('counts how often a retry hears a sequence it already had', { timeout: 60_000 }, () => {
    // §9: a retry is a new seed, not a guaranteed new sequence. A level has
    // only so many sequences that keep §3's rules, so repeats happen; this
    // walk says how often, for the whole sequence and for its round-3 start.
    const sameAsPrevious = (a: readonly number[], b: readonly number[], k: number): boolean =>
      a.slice(0, k).every((pad, i) => pad === b[i]);
    const tiers: Record<string, Record<string, number>> = {};
    const perLevel: Record<string, string> = {};
    for (const spec of LEVELS) {
      const seen = new Set<string>();
      let repeatsEarlier = 0;
      let wholeAsPrevious = 0;
      let round3AsPrevious = 0;
      let previous: readonly number[] | null = null;
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const pads = generateSequence(
          levelSeed(spec.level, attempt),
          spec.padCount,
          spec.target,
        ).pads;
        const key = pads.join('');
        if (seen.has(key)) repeatsEarlier += 1;
        seen.add(key);
        if (previous) {
          if (sameAsPrevious(pads, previous, spec.target)) wholeAsPrevious += 1;
          if (sameAsPrevious(pads, previous, FIRST_ROUND)) round3AsPrevious += 1;
        }
        previous = pads;
      }
      perLevel[`L${spec.level}`] =
        `distinct ${seen.size}, repeats an earlier attempt ${repeatsEarlier}, ` +
        `whole = previous ${wholeAsPrevious}, round 3 = previous ${round3AsPrevious}`;
      const tierKey = `pads${spec.padCount}`;
      if (!tiers[tierKey]) {
        tiers[tierKey] = { pairs: 0, repeatsEarlier: 0, wholeAsPrevious: 0, round3AsPrevious: 0 };
      }
      const tier = tiers[tierKey]!;
      tier.pairs! += ATTEMPTS - 1;
      tier.repeatsEarlier! += repeatsEarlier;
      tier.wholeAsPrevious! += wholeAsPrevious;
      tier.round3AsPrevious! += round3AsPrevious;
    }
    const daily = { pairs: 0, wholeAsPrevious: 0, round3AsPrevious: 0 };
    for (const day of DAYS) {
      let previous: readonly number[] | null = null;
      for (let attempt = 0; attempt < DAILY_ATTEMPTS; attempt++) {
        const pads = generateSequence(dailySeed(day, attempt), DAILY_PAD_COUNT, DAILY_TARGET).pads;
        if (previous) {
          daily.pairs += 1;
          if (sameAsPrevious(pads, previous, DAILY_TARGET)) daily.wholeAsPrevious += 1;
          if (sameAsPrevious(pads, previous, FIRST_ROUND)) daily.round3AsPrevious += 1;
        }
        previous = pads;
      }
    }
    console.log(
      [
        'retries (attempt n against n-1), levels × attempts 0..499:',
        ...Object.entries(perLevel).map(([level, line]) => `  ${level}: ${line}`),
        ...Object.entries(tiers).map(
          ([tier, t]) =>
            `  ${tier}: whole = previous ${t.wholeAsPrevious}/${t.pairs}, round 3 = previous ${t.round3AsPrevious}/${t.pairs} (${pct(t.round3AsPrevious!, t.pairs!)})`,
        ),
        `  daily: whole = previous ${daily.wholeAsPrevious}/${daily.pairs}, round 3 = previous ${daily.round3AsPrevious}/${daily.pairs} (${pct(daily.round3AsPrevious, daily.pairs)})`,
      ].join('\n'),
    );
    expect({ tiers, daily, perLevel }).toMatchInlineSnapshot(`
      {
        "daily": {
          "pairs": 730,
          "round3AsPrevious": 5,
          "wholeAsPrevious": 0,
        },
        "perLevel": {
          "L1": "distinct 142, repeats an earlier attempt 358, whole = previous 4, round 3 = previous 7",
          "L10": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 9",
          "L11": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 14",
          "L12": "distinct 387, repeats an earlier attempt 113, whole = previous 0, round 3 = previous 2",
          "L13": "distinct 468, repeats an earlier attempt 32, whole = previous 0, round 3 = previous 2",
          "L14": "distinct 493, repeats an earlier attempt 7, whole = previous 0, round 3 = previous 3",
          "L15": "distinct 499, repeats an earlier attempt 1, whole = previous 0, round 3 = previous 2",
          "L16": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 2",
          "L17": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 0",
          "L18": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 0",
          "L19": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 1",
          "L2": "distinct 334, repeats an earlier attempt 166, whole = previous 1, round 3 = previous 10",
          "L20": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 4",
          "L21": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 3",
          "L22": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 4",
          "L3": "distinct 432, repeats an earlier attempt 68, whole = previous 0, round 3 = previous 13",
          "L4": "distinct 473, repeats an earlier attempt 27, whole = previous 0, round 3 = previous 10",
          "L5": "distinct 493, repeats an earlier attempt 7, whole = previous 0, round 3 = previous 11",
          "L6": "distinct 496, repeats an earlier attempt 4, whole = previous 0, round 3 = previous 6",
          "L7": "distinct 498, repeats an earlier attempt 2, whole = previous 0, round 3 = previous 13",
          "L8": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 15",
          "L9": "distinct 500, repeats an earlier attempt 0, whole = previous 0, round 3 = previous 12",
        },
        "tiers": {
          "pads4": {
            "pairs": 5489,
            "repeatsEarlier": 632,
            "round3AsPrevious": 120,
            "wholeAsPrevious": 5,
          },
          "pads6": {
            "pairs": 5489,
            "repeatsEarlier": 153,
            "round3AsPrevious": 23,
            "wholeAsPrevious": 0,
          },
        },
      }
    `);
  });
});
