/**
 * Problem generation — docs/MAKE_THE_TARGET_RULES.md §6「生成の手順」.
 *
 * Per attempt k (its own rng, `createRng(seed + '#' + k)`, so every attempt
 * is reproducible from the seed alone): draw the tile count and the numbers,
 * build a solution first — n−1 merges of two random slots with a random legal
 * operator from the tier's build set — and take its last value as the
 * target. A target outside the band costs the attempt and nothing else; one
 * inside it is counted (`countWays`) and kept only if the tier's acceptance
 * predicate holds (tiers.ts `meetsTier`). The solution built is the one kept
 * with the problem — its existence is what the construction guarantees; the
 * tier is decided by the count, never by it.
 *
 * The gate is work, never wall clock: one budget per problem, WORK_LIMIT,
 * charged 1 per attempt plus the states each count expands. When it is
 * spent the generator does not guess — a bundled problem this generator made
 * (bundled.ts, re-proved by bundled.test.ts) ships instead, chosen by
 * `hashSeed(seed)`, marked `fallback`.
 *
 * Only newSession.ts calls into this module at play time, and only for a new
 * problem or the day's daily (§6「探索の走るとき」). Loading a saved game never
 * does — it replays the saved numbers and moves (restore.ts).
 */
import { BUNDLED_PROBLEMS, type BundledProblem } from './bundled';
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import { applyOperator, initialSlots } from './engine';
import { createRng, hashSeed, randomInt } from './rng';
import { decodeMoves } from './serialize';
import { countWays } from './solver';
import { MEDIUM_WAYS_MAX, TIERS, meetsTier, type TierSpec, type WayCounts } from './tiers';
import type { Difficulty, Move, Operator, Problem } from './types';

/**
 * The work one problem may spend (§6 step 7): attempts plus expanded states,
 * across every attempt. The plan's starting value, kept after the Phase 2
 * measurement (§15): no problem of the 1,000-seed walks or the 365 dailies
 * reached it, but the Medium walk's worst spent 48,238 — a ceiling that is
 * met now and then, not one far away, which is what the fallback is for.
 */
export const WORK_LIMIT = 50_000;

/** Medium's "÷ round" share (§7): the seed's first draw below this builds a ÷ problem. */
export const DIVISION_ROUND_SHARE = 1 / 3;

export interface GeneratedProblem {
  readonly problem: Problem;
  readonly ways: number;
  readonly waysWithoutDivision: number;
  /** True when the budget ran out and a bundled problem shipped (§6). */
  readonly fallback: boolean;
  /** Work spent: attempts plus expanded states (§6 step 7). */
  readonly work: number;
  /** Attempts drawn; the one that landed is the last. */
  readonly attempts: number;
  /** The most states one count of this problem's attempts expanded. */
  readonly worstCount: number;
  /**
   * Whether the problem shipped was built in a Medium ÷ round (§7): true only
   * for a generated Medium problem whose seed builds ÷ problems. False in the
   * other tiers and on a fallback — a bundled problem was not built in this
   * seed's round, and need not require ÷.
   */
  readonly divisionRound: boolean;
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

/** Step 2 of §6: the tile count, then the numbers (large ones first), ascending. */
export function drawNumbers(rng: () => number, tier: TierSpec): number[] {
  const n = pick(rng, tier.tileCounts);
  const large = tier.large === null ? 0 : pick(rng, tier.large.counts);
  const numbers: number[] = [];
  for (let i = 0; i < n; i++) {
    const [min, max] = i < large ? tier.large!.range : tier.small;
    numbers.push(randomInt(rng, min, max));
  }
  return numbers.sort((a, b) => a - b);
}

/**
 * Step 3 of §6: builds a solution over the dealt slots. Each of the n−1
 * merges picks two slots holding a number (every pair equally likely), puts
 * the larger on the left (the lower slot when equal), and picks one legal
 * operator from the tier's build set with equal chance. In a ÷ round, while
 * ÷ is unused and legal for the pair, ÷ is taken first with probability 1/2;
 * otherwise the rest are equally likely. Returns the moves and the value left.
 */
export function buildSolution(
  rng: () => number,
  numbers: readonly number[],
  operators: readonly Operator[],
  divisionRound: boolean,
): { moves: Move[]; value: number } {
  const slots = initialSlots(numbers);
  const moves: Move[] = [];
  let divided = false;
  for (let step = 1; step < numbers.length; step++) {
    const filled = slots.flatMap((value, slot) => (value === null ? [] : [slot]));
    const first = Math.floor(rng() * filled.length);
    let second = Math.floor(rng() * (filled.length - 1));
    if (second >= first) second++;
    const a = filled[Math.min(first, second)]!;
    const b = filled[Math.max(first, second)]!;
    // The larger value on the left; equal values: the lower slot on the left.
    const [left, right] = slots[b]! > slots[a]! ? [b, a] : [a, b];
    const x = slots[left]!;
    const y = slots[right]!;
    const legal = operators.filter((op) => applyOperator(op, x, y) !== null);
    let op: Operator;
    if (divisionRound && !divided && legal.includes('/') && rng() < 0.5) {
      op = '/';
    } else {
      const rest =
        divisionRound && !divided && legal.includes('/') ? legal.filter((o) => o !== '/') : legal;
      op = pick(rng, rest);
    }
    if (op === '/') divided = true;
    slots[right] = applyOperator(op, x, y);
    slots[left] = null;
    moves.push({ left, op, right });
  }
  return { moves, value: slots.find((v) => v !== null)! };
}

/** Whether a Medium seed builds ÷ problems (§7): its own rng's first draw. */
export function isDivisionRound(seed: string, difficulty: Difficulty): boolean {
  return difficulty === 'medium' && createRng(seed)() < DIVISION_ROUND_SHARE;
}

/**
 * Which half of Medium's predicate a round takes (§6 step 6, §7): a ÷ round
 * keeps only problems with no procedure free of ÷; any other round keeps
 * only problems with at most MEDIUM_WAYS_MAX procedures that Easy would not
 * take. Both halves sit inside `meetsTier('medium', …)`, which every
 * accepted problem also passes.
 */
function mediumRoundAccepts(
  divisionRound: boolean,
  numbers: readonly number[],
  target: number,
  counts: WayCounts,
): boolean {
  if (divisionRound) return counts.waysWithoutDivision === 0;
  return counts.ways <= MEDIUM_WAYS_MAX && !meetsTier('easy', numbers, target, counts);
}

/** What a search that ran out of budget reports instead of a problem. */
export interface SpentBudget {
  readonly problem: null;
  readonly work: number;
  readonly attempts: number;
  readonly worstCount: number;
}

/** A found problem before it is labelled with its tier. */
export interface SearchHit {
  readonly numbers: number[];
  readonly target: number;
  readonly moves: Move[];
  readonly counts: WayCounts;
  readonly work: number;
  readonly attempts: number;
  readonly worstCount: number;
}

/**
 * The attempt loop of §6 steps 1–7 for one tier shape and one acceptance
 * test, within `budget` work: each attempt costs 1, plus the states its
 * count expands (the count gets what is left). `generateFresh` runs it with
 * the shipped tiers; the six-tile measurement (hard6.measure.test.ts) runs
 * the same loop with a six-tile shape, so what it measures is this code.
 */
export function searchProblem(
  seed: string,
  tier: TierSpec,
  accept: (numbers: readonly number[], target: number, counts: WayCounts) => boolean,
  budget: number,
  divisionRound: boolean,
): SearchHit | SpentBudget {
  let work = 0;
  let attempts = 0;
  let worstCount = 0;
  while (work < budget) {
    const rng = createRng(`${seed}#${attempts}`);
    attempts++;
    work++;
    const numbers = drawNumbers(rng, tier);
    const { moves, value: target } = buildSolution(
      rng,
      numbers,
      tier.buildOperators,
      divisionRound,
    );
    if (target < tier.targetRange[0] || target > tier.targetRange[1]) continue;
    // A ÷ round keeps only problems with no ÷-free procedure; a solution built
    // without ÷ is one, so the count could only refuse it (§6 step 4).
    if (divisionRound && !moves.some((move) => move.op === '/')) continue;
    const counted = countWays(numbers, target, budget - work);
    work += counted.states;
    worstCount = Math.max(worstCount, counted.states);
    if (counted.capped) break;
    if (!accept(numbers, target, counted)) continue;
    return { numbers, target, moves, counts: counted, work, attempts, worstCount };
  }
  return { problem: null, work, attempts, worstCount };
}

/**
 * Runs §6 steps 1–7 for a tier within `budget` work. `problem` is null when
 * the budget runs out before an attempt lands — the caller decides what ships
 * then (`generateProblem`: the bundled table).
 */
export function generateFresh(
  seed: string,
  difficulty: Difficulty,
  budget: number = WORK_LIMIT,
): GeneratedProblem | SpentBudget {
  const divisionRound = isDivisionRound(seed, difficulty);
  const hit = searchProblem(
    seed,
    TIERS[difficulty],
    (numbers, target, counts) =>
      meetsTier(difficulty, numbers, target, counts) &&
      (difficulty !== 'medium' || mediumRoundAccepts(divisionRound, numbers, target, counts)),
    budget,
    divisionRound,
  );
  if (!('moves' in hit)) return hit;
  return {
    problem: { difficulty, numbers: hit.numbers, target: hit.target, solution: hit.moves },
    ways: hit.counts.ways,
    waysWithoutDivision: hit.counts.waysWithoutDivision,
    fallback: false,
    work: hit.work,
    attempts: hit.attempts,
    worstCount: hit.worstCount,
    divisionRound,
  };
}

/** A bundled problem as the game plays it. */
export function problemOfBundled(entry: BundledProblem, difficulty: Difficulty): Problem {
  return {
    difficulty,
    numbers: entry.numbers,
    target: entry.target,
    solution: decodeMoves(entry.solution, entry.numbers.length - 1)!,
  };
}

/** The bundled problem a seed falls back to (§6): `hashSeed(seed)` modulo the tier's count. */
export function bundledFor(seed: string, difficulty: Difficulty): BundledProblem {
  const table = BUNDLED_PROBLEMS[difficulty];
  return table[hashSeed(seed) % table.length]!;
}

/**
 * The problem for `seed` (§6): generated within `budget`, or — once the
 * budget is spent — the bundled problem the seed picks, marked `fallback`.
 * Deterministic: the same seed and budget always give the same problem.
 */
export function generateProblem(
  seed: string,
  difficulty: Difficulty,
  budget: number = WORK_LIMIT,
): GeneratedProblem {
  const made = generateFresh(seed, difficulty, budget);
  if (made.problem !== null) return made as GeneratedProblem;
  const entry = bundledFor(seed, difficulty);
  return {
    problem: problemOfBundled(entry, difficulty),
    ways: entry.ways,
    waysWithoutDivision: entry.waysWithoutDivision,
    fallback: true,
    work: made.work,
    attempts: made.attempts,
    worstCount: made.worstCount,
    divisionRound: false,
  };
}

/** The day's problem (§8): Medium, from the local date's seed. */
export function dailyProblem(dateString: string): GeneratedProblem {
  return generateProblem(dailySeed(dateString), DAILY_DIFFICULTY);
}
