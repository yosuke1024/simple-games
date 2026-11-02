/**
 * Where a Backgammon roll comes from (docs/BACKGAMMON_RULES.md §4).
 *
 * The `rollIndex`-th roll of the match seeded `seed` is two faces drawn from
 * `createRng(`${seed}:dice:${rollIndex}`)`, which gives it the three
 * properties Ludo's dice have, each pinned by dice.test.ts:
 *
 *   - **Deterministic.** The seed and the count of rolls made so far are the
 *     only inputs; the same match replays the same dice on any device.
 *   - **Uniform.** Each face is a float uniform on [0, 1) scaled and floored —
 *     no rounding, retry or modulo bias.
 *   - **Unbiased by side.** `rollIndex` counts rolls across the whole match,
 *     the opening throws included, so neither side's dice come from a
 *     different slice of the sequence than the other's.
 *
 * The CPU is never given more than this: `BackgammonView` (cpu.ts) carries
 * the current roll and the public board, never the seed, the RNG, or any
 * future roll.
 */
import { createRng } from './rng';

export type Roll = readonly [number, number];

/** The two faces of the `rollIndex`-th roll, each 1..6. */
export function rollFor(seed: string, rollIndex: number): Roll {
  const rng = createRng(`${seed}:dice:${rollIndex}`);
  const first = Math.floor(rng() * 6) + 1;
  const second = Math.floor(rng() * 6) + 1;
  return [first, second];
}

/** The dice a roll puts on the table: four of a kind for doubles (§2.1). */
export function diceOf(roll: Roll): readonly number[] {
  const [a, b] = roll;
  return a === b ? [a, a, a, a] : [a, b];
}

/**
 * The 21 distinct rolls with their weights out of 36: doubles once, every
 * other pair twice (§5.2). Enumerated rather than sampled, so an expectation
 * over the opponent's roll is exact.
 */
export const DISTINCT_ROLLS: readonly { readonly roll: Roll; readonly weight: number }[] = (() => {
  const out: { roll: Roll; weight: number }[] = [];
  for (let a = 1; a <= 6; a++) {
    for (let b = a; b <= 6; b++) out.push({ roll: [a, b], weight: a === b ? 1 : 2 });
  }
  return out;
})();
