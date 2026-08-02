/**
 * Deterministic PRNG: xmur3 string hash seeding mulberry32. The same seed
 * string always yields the same wave, which is what lets a run be replayed
 * and a test assert on real generated content.
 *
 * Copied rather than shared: games stay independent (docs/ARCHITECTURE.md),
 * the same reason water-sort carries its own copy.
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
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a function producing floats in [0, 1), deterministic per seed. */
export function createRng(seed: string): () => number {
  return mulberry32(xmur3(seed)());
}
