/**
 * Deterministic PRNG: xmur3 string hash seeding mulberry32 — the same pair
 * the other games carry (docs/OVERTAKE_RULES.md §5). The same seed string
 * always yields the same course, which is what makes a retry the same race
 * and lets a test pin real generated content.
 *
 * Copied rather than shared: games stay independent (docs/ARCHITECTURE.md).
 *
 * Unlike the copies that return a float, this one hands out the raw 32-bit
 * word and draws bounded integers from it with integer arithmetic only
 * (§1「数の規則」): `Math.floor(word × n / 2^32)` is exact while
 * word × n < 2^53, which every caller here keeps (n ≤ 2^20).
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Unsigned 32-bit words, deterministic per seed. */
export type Rng = () => number;

export function createRng(seed: string): Rng {
  return mulberry32(xmur3(seed)());
}

const WORD = 4294967296;
/** The largest bound `randInt` accepts: keeps word × n below 2^53. */
export const RAND_INT_LIMIT = 1 << 20;

/** A uniform integer in 0..n − 1 (n ≥ 1), from integer arithmetic only. */
export function randInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > RAND_INT_LIMIT) {
    throw new RangeError(`randInt bound out of range: ${n}`);
  }
  return Math.floor((rng() * n) / WORD);
}

/** Picks an index by integer weights (all ≥ 0, at least one > 0). */
export function pickWeighted(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let roll = randInt(rng, total);
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return i;
  }
  return weights.length - 1;
}
