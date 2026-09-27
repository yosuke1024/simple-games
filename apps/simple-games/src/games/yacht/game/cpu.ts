/**
 * The CPU's line (docs/YACHT_RULES.md §5). One strength, no board-size lever
 * the way Dots and Boxes has one (`games/dots-and-boxes/game/cpu.ts`) — Yacht
 * has no second knob to vary, so the CPU is a single, deterministic
 * one-turn expectimax over the dice it is about to throw:
 *
 *   1. **immediate(dice)** — the best box open right now, judged not by raw
 *      points but against a *regret* baseline (`BASELINE`): what an average
 *      turn is worth in that box. A box scoring below its baseline is a loss
 *      relative to a typical turn, so the CPU dumps a bad throw where it
 *      costs the least, and keeps a big score for the box it is best in.
 *   2. **E1 / E2** — the expected value of throwing again, one and two
 *      throws still to come, computed once per distinct dice state (the 252
 *      sorted five-dice multisets) and memoised for the rest of the call.
 *   3. The turn's actual decision — roll, set a keep, or take a box — reads
 *      off `rollsUsed` and a comparison of "score now" against "the best
 *      throw available".
 *
 * No randomness anywhere: the same input always yields the same action, so a
 * replayed match reaches the same result (`game/compatibility.test.ts` pins
 * one full game). No board size to choose, so no "which CPU" — the dice
 * already carry all the variance a fair, findable opponent needs
 * (docs/DOTS_AND_BOXES_RULES.md §4, §11 argue the analogous case there).
 *
 * The search never looks at the player's sheet (§5): the two turns do not
 * interact until the very last box, and that information would not change
 * anything the CPU can still choose. Pure function on data — no session
 * import, so `session.ts` can import this without a cycle.
 */
import { scoreFor } from './engine';
import {
  CATEGORIES,
  DICE_COUNT,
  FACES,
  ROLLS_PER_TURN,
  type Category,
  type Dice,
  type Scores,
} from './types';

export interface CpuInput {
  readonly dice: Dice;
  readonly held: readonly boolean[];
  /** Throws used this turn — the same range as `session.RollsUsed`. */
  readonly rollsUsed: 0 | 1 | 2 | 3;
  readonly cpuScores: Scores;
}

export type CpuAction =
  { kind: 'roll' } | { kind: 'hold'; held: boolean[] } | { kind: 'score'; category: Category };

/**
 * Work done by the last call, for the test gate (like dots-and-boxes's
 * `cpuCost`, docs/GAME_LIFECYCLE.md「CPU 探索」): every `immediate`
 * evaluation and every probability-weighted term summed while comparing keep
 * options. Reset to 0 at the start of each call; meaningful only right after
 * one (`game/cpu.test.ts` gates it under 1,000,000).
 */
export const cpuCost = { work: 0 };

/**
 * What a turn in this box is worth on average against a fresh throw — the
 * regret baseline `immediate` measures every open box against (§5). The
 * upper six are roughly face × 2.1 (about what a three-throw chase for that
 * face collects); the rest are a rough three-throw average for that
 * condition. Taking 0 in Sixes costs far more than 0 in Ones, so a forced
 * dump lands on the cheapest box, not the biggest number.
 */
const BASELINE: Record<Category, number> = {
  ones: 2.1,
  twos: 4.2,
  threes: 6.3,
  fours: 8.4,
  fives: 10.5,
  sixes: 12.6,
  fullHouse: 8,
  fourOfAKind: 6,
  littleStraight: 9,
  bigStraight: 9,
  choice: 22,
  yacht: 2.5,
};

/** Every sorted multiset of `n` dice, faces 1..FACES, in ascending order. */
function multisetsOfLength(n: number): number[][] {
  const out: number[][] = [];
  const walk = (from: number, prefix: number[]) => {
    if (prefix.length === n) {
      out.push(prefix);
      return;
    }
    for (let face = from; face <= FACES; face++) walk(face, [...prefix, face]);
  };
  walk(1, []);
  return out;
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/** The probability of drawing exactly this sorted multiset in one throw. */
function multisetProbability(faces: readonly number[]): number {
  const k = faces.length;
  if (k === 0) return 1;
  const counts = new Map<number, number>();
  for (const face of faces) counts.set(face, (counts.get(face) ?? 0) + 1);
  let denominator = 1;
  for (const count of counts.values()) denominator *= factorial(count);
  return factorial(k) / denominator / FACES ** k;
}

/**
 * The 252 sorted five-dice states, computed once, and an index from a
 * state's sorted key back to its slot — the memoisation the CPU's search
 * shares across every call (§5).
 */
const ALL_STATES: readonly (readonly number[])[] = multisetsOfLength(DICE_COUNT);
const STATE_INDEX: ReadonlyMap<string, number> = new Map(
  ALL_STATES.map((state, index) => [state.join(','), index]),
);

/** Every outcome of throwing `k` dice, with its probability — k = 0..DICE_COUNT. */
const OUTCOMES: readonly (readonly {
  readonly faces: readonly number[];
  readonly prob: number;
}[])[] = Array.from({ length: DICE_COUNT + 1 }, (_, k) =>
  multisetsOfLength(k).map((faces) => ({ faces, prob: multisetProbability(faces) })),
);

const stateKey = (dice: readonly number[]): string => [...dice].sort((a, b) => a - b).join(',');

/** The index of `dice`'s state, whatever order the actual dice happen to be in. */
const indexOfDice = (dice: readonly number[]): number => STATE_INDEX.get(stateKey(dice))!;

/**
 * Every raw five-dice tuple (`FACES ** DICE_COUNT` = 7,776 of them), read as
 * a base-`FACES` number, mapped once to its canonical (sorted) state's
 * index. `combinedStateIndex` below turns a keep plus a throw's faces into a
 * state index with pure arithmetic — no array building, sorting or string
 * keys inside the search's hot loop, which is what keeps one call's some
 * 400,000 (K, o) terms (§5) well inside a 450ms beat.
 */
const RAW_TO_STATE: Int32Array = (() => {
  const table = new Int32Array(FACES ** DICE_COUNT);
  const raw = new Array<number>(DICE_COUNT);
  for (let code = 0; code < table.length; code++) {
    let remainder = code;
    for (let position = DICE_COUNT - 1; position >= 0; position--) {
      raw[position] = (remainder % FACES) + 1;
      remainder = Math.floor(remainder / FACES);
    }
    table[code] = STATE_INDEX.get(stateKey(raw))!;
  }
  return table;
})();

/**
 * The state reached by keeping `heldValues` and drawing `outcomeFaces`
 * (together always five dice), by raw arithmetic rather than by building and
 * sorting a combined array (§5).
 */
function combinedStateIndex(
  heldValues: readonly number[],
  outcomeFaces: readonly number[],
): number {
  let code = 0;
  for (const value of heldValues) code = code * FACES + (value - 1);
  for (const value of outcomeFaces) code = code * FACES + (value - 1);
  return RAW_TO_STATE[code]!;
}

interface KeepOption {
  /** Sorted values this option keeps — what E1/E2 and `immediate` need. */
  readonly heldValues: readonly number[];
  readonly size: number;
}

/**
 * Every distinct value-multiset a five-dice state could keep (§5): the up to
 * 32 subsets of its five positions, deduplicated by the values they hold —
 * repeated faces make many position-subsets equivalent, so this is never
 * more than 32 and often far fewer.
 */
function keepOptions(dice: readonly number[]): KeepOption[] {
  const seen = new Map<string, KeepOption>();
  for (let mask = 0; mask < 1 << DICE_COUNT; mask++) {
    const heldValues: number[] = [];
    for (let i = 0; i < DICE_COUNT; i++) if (mask & (1 << i)) heldValues.push(dice[i]!);
    heldValues.sort((a, b) => a - b);
    const key = heldValues.join(',');
    if (!seen.has(key)) seen.set(key, { heldValues, size: heldValues.length });
  }
  return [...seen.values()];
}

/**
 * The hold mask on the real, ordered dice that keeps exactly `heldValues`
 * (§5): scan the dice left to right and keep the first die of each face the
 * option still needs. Deterministic, so the same dice and the same chosen
 * keep always produce the same mask.
 */
function maskFor(dice: readonly number[], heldValues: readonly number[]): boolean[] {
  const need = new Map<number, number>();
  for (const value of heldValues) need.set(value, (need.get(value) ?? 0) + 1);
  return dice.map((face) => {
    const remaining = need.get(face) ?? 0;
    if (remaining <= 0) return false;
    need.set(face, remaining - 1);
    return true;
  });
}

/**
 * The CPU's next action (§5) from the dice on the table, its keeps, the
 * throws used this turn, and its own sheet — never the player's.
 */
export function chooseCpuAction(input: CpuInput): CpuAction {
  cpuCost.work = 0;
  const { dice, held, rollsUsed, cpuScores } = input;

  // The first throw is mandatory, and there is nothing yet to weigh (§2).
  if (rollsUsed === 0) return { kind: 'roll' };

  const openCategories = CATEGORIES.filter((_, index) => cpuScores[index] === null);

  // immediate(dice): memoised per state, for the rest of this call only —
  // which boxes are open changes from one turn to the next.
  const immediateCache = new Array<{ value: number; category: Category } | undefined>(
    ALL_STATES.length,
  );
  const immediateAt = (index: number): { value: number; category: Category } => {
    const cached = immediateCache[index];
    if (cached) return cached;
    cpuCost.work += 1;
    const stateDice = ALL_STATES[index]!;
    let bestValue = -Infinity;
    let bestCategory = openCategories[0]!;
    for (const category of openCategories) {
      const value = scoreFor(category, stateDice) - BASELINE[category];
      if (value > bestValue) {
        bestValue = value;
        bestCategory = category;
      }
    }
    const result = { value: bestValue, category: bestCategory };
    immediateCache[index] = result;
    return result;
  };

  const currentIndex = indexOfDice(dice);

  // Third throw used: no choice left but to take a box (§2).
  if (rollsUsed === ROLLS_PER_TURN) {
    return { kind: 'score', category: immediateAt(currentIndex).category };
  }

  // E1(D): one throw left after this one. Only built when rollsUsed === 1
  // needs it (two throws still to come); memoised per state either way.
  const e1Cache = new Array<number | undefined>(ALL_STATES.length);
  const e1At = (index: number): number => {
    const cached = e1Cache[index];
    if (cached !== undefined) return cached;
    let best = -Infinity;
    for (const option of keepOptions(ALL_STATES[index]!)) {
      const outcomes = OUTCOMES[DICE_COUNT - option.size]!;
      let expected = 0;
      for (const outcome of outcomes) {
        const combined = combinedStateIndex(option.heldValues, outcome.faces);
        expected += outcome.prob * immediateAt(combined).value;
        cpuCost.work += 1;
      }
      if (expected > best) best = expected;
    }
    e1Cache[index] = best;
    return best;
  };

  const stop = immediateAt(currentIndex);

  // The best keep other than "keep everything" — K = D is not a throw at
  // all, so it is excluded from the actual decision (unlike inside E1/E2
  // above, where "keep everything" is one ordinary option among many).
  let best: { heldValues: readonly number[]; size: number; value: number } | null = null;
  for (const option of keepOptions(dice)) {
    if (option.size === DICE_COUNT) continue;
    const outcomes = OUTCOMES[DICE_COUNT - option.size]!;
    let expected = 0;
    for (const outcome of outcomes) {
      const combined = combinedStateIndex(option.heldValues, outcome.faces);
      const term = rollsUsed === 1 ? e1At(combined) : immediateAt(combined).value;
      expected += outcome.prob * term;
      cpuCost.work += 1;
    }
    // Ties favour keeping more dice, then whichever option turned up first.
    if (
      best === null ||
      expected > best.value ||
      (expected === best.value && option.size > best.size)
    ) {
      best = { heldValues: option.heldValues, size: option.size, value: expected };
    }
  }
  // rollsUsed is 1 or 2 here, so a throw is still possible and `keepOptions`
  // always offers at least "keep nothing" besides "keep everything".
  const chosen = best!;

  if (stop.value >= chosen.value) {
    return { kind: 'score', category: stop.category };
  }
  const mask = maskFor(dice, chosen.heldValues);
  if (held.length === mask.length && held.every((kept, i) => kept === mask[i])) {
    return { kind: 'roll' };
  }
  return { kind: 'hold', held: mask };
}
