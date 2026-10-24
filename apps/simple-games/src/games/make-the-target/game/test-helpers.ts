/**
 * Independent re-counts for the tests (docs/MAKE_THE_TARGET_RULES.md §15).
 * Neither shares code with solver.ts `countWays`, and neither keeps a memo:
 *
 * - `slotLevelCounts` walks every procedure tile by tile — every ordered pair
 *   of slots holding a number, every operator, through engine.ts's own
 *   `applyMove` — writes each procedure as its sequence of value moves, and
 *   counts the distinct strings per final value. It is the oracle of
 *   guarantee.test.ts and is exact, but it walks up to 9,216 tile-level
 *   procedures for 4 tiles and 737,280 for 5, so it is used on 4 tiles and on
 *   a small 5-tile sample.
 * - `plainCounts` walks value moves without a memo (each distinct pair of
 *   values, each legal operator, larger on the left), so every leaf is one
 *   procedure; it is cheap enough to re-count every accepted problem of the
 *   1,000-seed walks. guarantee.test.ts checks it against `slotLevelCounts`.
 *
 * Both also return the largest value any legal procedure passes through —
 * the bound of §1 is checked on them.
 */
import { applyMove, applyOperator, initialSlots, replay } from './engine';
import { generateProblem, generateFresh, WORK_LIMIT, type GeneratedProblem } from './generator';
import { BUNDLED_PER_TIER, bundledSeed } from './bundled';
import { encodeMoves } from './serialize';
import { meetsTier } from './tiers';
import { OPERATORS, type Difficulty, type Slots } from './types';

export interface Recount {
  /** Final value → [ways, waysWithoutDivision]. */
  readonly byValue: ReadonlyMap<number, readonly [number, number]>;
  /** The largest value any legal procedure from the numbers reaches. */
  readonly maxValue: number;
  /**
   * `slotLevelCounts` only: final value → each distinct procedure, written
   * `x op y` per value move (larger first), moves joined by `|`.
   */
  readonly paths?: ReadonlyMap<number, ReadonlySet<string>>;
}

export function countsFor(
  recount: Recount,
  target: number,
): { ways: number; waysWithoutDivision: number } {
  const [ways, waysWithoutDivision] = recount.byValue.get(target) ?? [0, 0];
  return { ways, waysWithoutDivision };
}

/** The tile-level oracle: every procedure over slots, deduplicated by its value moves. */
export function slotLevelCounts(numbers: readonly number[]): Recount {
  const all = new Map<number, Set<string>>();
  const withoutDivision = new Map<number, Set<string>>();
  let maxValue = Math.max(...numbers);
  const walk = (slots: Slots, path: string, divided: boolean): void => {
    const filled = slots.flatMap((v, s) => (v === null ? [] : [s]));
    if (filled.length === 1) {
      const value = slots[filled[0]!]!;
      if (!all.has(value)) all.set(value, new Set());
      all.get(value)!.add(path);
      if (!divided) {
        if (!withoutDivision.has(value)) withoutDivision.set(value, new Set());
        withoutDivision.get(value)!.add(path);
      }
      return;
    }
    for (const left of filled) {
      for (const right of filled) {
        for (const op of OPERATORS) {
          const next = applyMove(slots, { left, op, right });
          if (next === null) continue;
          const x = slots[left]!;
          const y = slots[right]!;
          const result = next[right]!;
          maxValue = Math.max(maxValue, result);
          const step = `${Math.max(x, y)}${op}${Math.min(x, y)}`;
          walk(next, path === '' ? step : `${path}|${step}`, divided || op === '/');
        }
      }
    }
  };
  walk(initialSlots(numbers), '', false);
  const byValue = new Map<number, readonly [number, number]>();
  for (const [value, paths] of all) {
    byValue.set(value, [paths.size, withoutDivision.get(value)?.size ?? 0]);
  }
  return { byValue, maxValue, paths: all };
}

/** The memo-free value-level re-count: each leaf of the walk is one procedure. */
export function plainCounts(numbers: readonly number[]): Recount {
  const byValue = new Map<number, [number, number]>();
  let maxValue = Math.max(...numbers);
  const walk = (values: number[], divided: boolean): void => {
    if (values.length === 1) {
      const value = values[0]!;
      const entry = byValue.get(value) ?? [0, 0];
      entry[0]++;
      if (!divided) entry[1]++;
      byValue.set(value, entry);
      return;
    }
    const seenPairs = new Set<string>();
    for (let i = 0; i < values.length; i++) {
      for (let j = 0; j < values.length; j++) {
        if (i === j) continue;
        const x = values[i]!;
        const y = values[j]!;
        if (x < y) continue; // the larger on the left; + and × once per pair
        const pairKey = `${x},${y}`;
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);
        const rest = values.filter((_, k) => k !== i && k !== j);
        for (const op of OPERATORS) {
          const result = applyOperator(op, x, y);
          if (result === null) continue;
          maxValue = Math.max(maxValue, result);
          walk([...rest, result], divided || op === '/');
        }
      }
    }
  };
  walk([...numbers], false);
  return { byValue, maxValue };
}

/** One bundled seed's problem, in bundled.ts's form. */
export interface BundledSeed {
  readonly seed: string;
  readonly k: number;
  readonly made: {
    readonly numbers: readonly number[];
    readonly target: number;
    readonly solution: string;
    readonly ways: number;
    readonly waysWithoutDivision: number;
  };
}

/**
 * The bundled table's provenance (§6): seeds `make-the-target-bundled-
 * <difficulty>-<k>` for k = 1, 2, …, generated within WORK_LIMIT, until
 * BUNDLED_PER_TIER have landed. A seed is skipped when it runs out of budget
 * or when it makes the same numbers and target as an earlier row (two seeds
 * can land on one problem; a fallback table of repeats would be a smaller
 * table). `skipped` names each skipped seed and why.
 */
export function bundledSeeds(difficulty: Difficulty): {
  rows: BundledSeed[];
  skipped: { seed: string; reason: 'budget' | 'repeat' }[];
} {
  const rows: BundledSeed[] = [];
  const skipped: { seed: string; reason: 'budget' | 'repeat' }[] = [];
  const seen = new Set<string>();
  for (let k = 1; rows.length < BUNDLED_PER_TIER && k < 10_000; k++) {
    const seed = bundledSeed(difficulty, k);
    const made = generateFresh(seed, difficulty, WORK_LIMIT);
    if (made.problem === null) {
      skipped.push({ seed, reason: 'budget' });
      continue;
    }
    const key = `${made.problem.numbers.join(',')}=${made.problem.target}`;
    if (seen.has(key)) {
      skipped.push({ seed, reason: 'repeat' });
      continue;
    }
    seen.add(key);
    rows.push({
      seed,
      k,
      made: {
        numbers: made.problem.numbers,
        target: made.problem.target,
        solution: encodeMoves(made.problem.solution),
        ways: made.ways,
        waysWithoutDivision: made.waysWithoutDivision,
      },
    });
  }
  return { rows, skipped };
}

/** The p-th percentile (nearest rank) of a list of numbers. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1]!;
}

/**
 * The bound of §1 on every intermediate value: the product of max(v, 2)
 * over the dealt numbers.
 */
export const intermediateBound = (numbers: readonly number[]): number =>
  numbers.reduce((product, v) => product * Math.max(v, 2), 1);

/** The tier-wide bound of §1 (v1): Easy 10,000, Medium 100,000, Hard 625,000. */
export const TIER_VALUE_BOUND: Record<Difficulty, number> = {
  easy: 10_000,
  medium: 100_000,
  hard: 625_000,
};

/** One generated problem, checked against the independent re-count. */
export interface WalkedProblem {
  readonly seed: string;
  readonly generated: GeneratedProblem;
  readonly recount: { ways: number; waysWithoutDivision: number };
  readonly maxValue: number;
  readonly ms: number;
}

/** What a walk of seeds found — everything §15 asks to print. */
export interface WalkReport {
  readonly difficulty: Difficulty;
  readonly problems: readonly WalkedProblem[];
  /** Problems that broke a promise of §6–§7, with the reason. Empty when all hold. */
  readonly failures: readonly string[];
  readonly ms: number;
}

/**
 * Generates each seed with the shipped budget and checks it against what §6
 * and §7 promise, with nothing taken from the generator on trust: the counts
 * are re-made by `plainCounts` (no memo), the tier predicate is applied to
 * those, the saved solution is replayed through the rules to the target, a
 * Medium ÷ round has no procedure free of ÷, and no intermediate value of any
 * legal procedure passes the bound of §1.
 */
export function walkSeeds(difficulty: Difficulty, seeds: readonly string[]): WalkReport {
  const started = performance.now();
  const problems: WalkedProblem[] = [];
  const failures: string[] = [];
  for (const seed of seeds) {
    const t0 = performance.now();
    const generated = generateProblem(seed, difficulty);
    const ms = performance.now() - t0;
    const { problem } = generated;
    const recounted = plainCounts(problem.numbers);
    const recount = countsFor(recounted, problem.target);
    problems.push({ seed, generated, recount, maxValue: recounted.maxValue, ms });
    const fail = (why: string) => failures.push(`${seed}: ${why}`);
    if (
      recount.ways !== generated.ways ||
      recount.waysWithoutDivision !== generated.waysWithoutDivision
    ) {
      fail(
        `counts ${generated.ways}/${generated.waysWithoutDivision} vs ${recount.ways}/${recount.waysWithoutDivision}`,
      );
    }
    if (!meetsTier(difficulty, problem.numbers, problem.target, recount)) fail('tier predicate');
    if (generated.divisionRound && recount.waysWithoutDivision !== 0) {
      fail('÷ round without ÷ required');
    }
    const replayed = replay(problem.numbers, problem.solution);
    if (
      replayed === null ||
      problem.solution.length !== problem.numbers.length - 1 ||
      replayed.slots.find((v) => v !== null) !== problem.target
    ) {
      fail('solution does not replay to the target');
    }
    if (recounted.maxValue > intermediateBound(problem.numbers)) fail('intermediate bound');
    if (recounted.maxValue > TIER_VALUE_BOUND[difficulty]) fail('tier value bound');
    if (generated.work > WORK_LIMIT) fail(`work ${generated.work}`);
  }
  return { difficulty, problems, failures, ms: performance.now() - started };
}

/**
 * The distributions of a walk that the rules document quotes (§6 step 7,
 * §7's table, §15) — every one deterministic, so the quality tests pin them.
 * Wall clock is not here: it is printed by `describeWalk` and never asserted.
 */
export interface WalkSummary {
  /** Problems that fell back to the bundled table (= reached WORK_LIMIT). */
  readonly fallbacks: number;
  /** `ways` of the generated problems: p10, p50, p90, max. */
  readonly ways: readonly number[];
  /** Generated problems no ÷-free procedure solves. */
  readonly divisionRequired: number;
  /** Their `ways`: p10, p50, p90, max; empty when there are none. */
  readonly divisionRequiredWays: readonly number[];
  /** Problems built in a Medium ÷ round. */
  readonly divisionRounds: number;
  /** Tile count → problems, ascending by tile count. */
  readonly tiles: Readonly<Record<number, number>>;
  /** Attempts: p50, p99, max. */
  readonly attempts: readonly number[];
  /** Work per problem: p50, p99, max. */
  readonly work: readonly number[];
  /** The most states one count expanded, over the walk. */
  readonly worstCount: number;
  /** The largest intermediate value any legal procedure reaches, over the walk. */
  readonly largest: number;
}

const quartiles = (values: readonly number[]) =>
  values.length === 0 ? [] : [10, 50, 90, 100].map((p) => percentile(values, p));

export function summarizeWalk(report: WalkReport): WalkSummary {
  const { problems } = report;
  const fresh = problems.filter((p) => !p.generated.fallback);
  const divided = fresh.filter((p) => p.generated.waysWithoutDivision === 0);
  const tiles: Record<number, number> = {};
  for (const p of problems) {
    const n = p.generated.problem.numbers.length;
    tiles[n] = (tiles[n] ?? 0) + 1;
  }
  const attempts = problems.map((p) => p.generated.attempts);
  const work = problems.map((p) => p.generated.work);
  return {
    fallbacks: problems.length - fresh.length,
    ways: quartiles(fresh.map((p) => p.generated.ways)),
    divisionRequired: divided.length,
    divisionRequiredWays: quartiles(divided.map((p) => p.generated.ways)),
    divisionRounds: problems.filter((p) => p.generated.divisionRound).length,
    tiles,
    attempts: [50, 99, 100].map((p) => percentile(attempts, p)),
    work: [50, 99, 100].map((p) => percentile(work, p)),
    worstCount: Math.max(0, ...problems.map((p) => p.generated.worstCount)),
    largest: Math.max(0, ...problems.map((p) => p.maxValue)),
  };
}

/** The lines a walk prints (§15): the distributions the rules document quotes, and wall clock. */
export function describeWalk(label: string, report: WalkReport): string[] {
  const s = summarizeWalk(report);
  const q = (values: readonly number[]) =>
    values.length === 0
      ? '-'
      : `p10 ${values[0]} / p50 ${values[1]} / p90 ${values[2]} / max ${values[3]}`;
  const ms = report.problems.map((p) => p.ms);
  return [
    `[make-the-target] ${label}: ${report.problems.length} problems, fallbacks ${s.fallbacks} (reached WORK_LIMIT ${s.fallbacks})`,
    `  ways ${q(s.ways)}`,
    `  ÷ required ${s.divisionRequired}, ÷ rounds ${s.divisionRounds}, tiles ${Object.entries(
      s.tiles,
    )
      .map(([n, c]) => `${n}:${c}`)
      .join(' ')}`,
    `  ways where ÷ is required ${q(s.divisionRequiredWays)}`,
    `  attempts p50 ${s.attempts[0]} / p99 ${s.attempts[1]} / max ${s.attempts[2]}`,
    `  work p50 ${s.work[0]} / p99 ${s.work[1]} / max ${s.work[2]}; worst single count ${s.worstCount} states`,
    `  largest intermediate ${s.largest}`,
    `  wall clock (reported, never a gate): p50 ${percentile(ms, 50).toFixed(2)} ms / p99 ${percentile(ms, 99).toFixed(2)} ms / max ${Math.max(...ms).toFixed(2)} ms; walk ${report.ms.toFixed(0)} ms`,
  ];
}
