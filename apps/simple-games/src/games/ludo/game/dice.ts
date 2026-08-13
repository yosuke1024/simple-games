/**
 * Where a Ludo roll comes from.
 *
 * Every die is `createRng(`${seed}:dice:${rollIndex}`)()` turned into 1..6.
 * That gives it three properties, each checked by a test in
 * dice.test.ts:
 *
 *   - **Deterministic.** The seed and the count of rolls made so far are the
 *     only inputs; the same match replays the same sequence of dice on any
 *     device, forever.
 *   - **Uniform.** `rollFor` scales and floors a float already guaranteed to
 *     land in [0, 1) (see below) — no rounding, retry, or modulo bias to
 *     correct for.
 *   - **Unbiased by seat.** `rollIndex` counts rolls across the whole match,
 *     not per seat, so no seat's dice are drawn from a different slice of
 *     the sequence than any other's.
 *
 * The CPU is never given more than this: `LudoView` (cpu.ts) carries the
 * current roll and the public board, never the seed, the RNG, or any future
 * roll. A seat cannot see, and this module cannot be made to produce,
 * anything about a roll before it happens.
 */
import { createRng } from './rng';

/**
 * The die for the `rollIndex`-th roll of the match seeded `seed`, as the
 * face value 1..6.
 *
 * `createRng` returns floats uniform on [0, 1); multiplying by six and
 * flooring therefore lands evenly on the six integers 0..5, and adding one
 * turns that into a face value.
 */
export function rollFor(seed: string, rollIndex: number): number {
  const rng = createRng(`${seed}:dice:${rollIndex}`);
  return Math.floor(rng() * 6) + 1;
}
