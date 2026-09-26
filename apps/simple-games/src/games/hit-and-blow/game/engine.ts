/**
 * The rules of one guess (docs/HIT_AND_BLOW_RULES.md §2, §4): what the secret
 * is, what a guess may be, and what it scores. Pure functions over plain
 * arrays — no identity, no time, and randomness only through the seed.
 */
import { createRng, shuffled } from './rng';
import { POOL_FOR, SLOTS_FOR, type Code, type Difficulty, type Feedback } from './types';

/** The symbol indices a difficulty plays with, in order (§1). */
export function poolOf(difficulty: Difficulty): number[] {
  return Array.from({ length: POOL_FOR[difficulty] }, (_, index) => index);
}

/**
 * The secret a seed deals (§2): the pool shuffled by the seed, first N taken.
 * No symbol can repeat — the pool holds each one once — and the same seed
 * always deals the same code, which is why the secret is derived on load
 * rather than written into the save.
 */
export function secretFor(seed: string, difficulty: Difficulty): Code {
  return shuffled(poolOf(difficulty), createRng(`${seed}:secret`)).slice(0, SLOTS_FOR[difficulty]);
}

/**
 * Hits and blows (§4), counted as multisets so the answer stays right even
 * for input the UI never produces — a repeated symbol in the secret or the
 * guess. Hits are positional matches; blows are the symbols the two codes
 * share, counted with multiplicity, less the hits.
 */
export function judge(secret: Code, guess: Code): Feedback {
  let hits = 0;
  const inSecret = new Map<number, number>();
  const inGuess = new Map<number, number>();
  const length = Math.min(secret.length, guess.length);
  for (let i = 0; i < length; i++) {
    if (secret[i] === guess[i]) hits += 1;
  }
  for (const symbol of secret) inSecret.set(symbol, (inSecret.get(symbol) ?? 0) + 1);
  for (const symbol of guess) inGuess.set(symbol, (inGuess.get(symbol) ?? 0) + 1);
  let shared = 0;
  for (const [symbol, count] of inGuess) shared += Math.min(count, inSecret.get(symbol) ?? 0);
  return { hits, blows: shared - hits };
}

/** True when every position holds the secret's symbol (§5). */
export function isSolvedBy(secret: Code, guess: Code): boolean {
  return secret.length === guess.length && judge(secret, guess).hits === secret.length;
}

/**
 * A guess the rules accept for this difficulty (§2, §3): exactly N positions,
 * every one a whole index inside the pool, and no symbol twice.
 */
export function isValidGuess(guess: readonly unknown[], difficulty: Difficulty): guess is Code {
  if (guess.length !== SLOTS_FOR[difficulty]) return false;
  const seen = new Set<number>();
  for (const symbol of guess) {
    if (typeof symbol !== 'number' || !Number.isInteger(symbol)) return false;
    if (symbol < 0 || symbol >= POOL_FOR[difficulty]) return false;
    if (seen.has(symbol)) return false;
    seen.add(symbol);
  }
  return true;
}
