/**
 * The rules of one guess (docs/HIT_AND_BLOW_RULES.md §2, §4): the secret a
 * seed deals, the guesses the rules accept, and what a guess scores —
 * including for repeated symbols the UI never produces, because the judge is
 * written not to trust where its input came from.
 */
import { describe, expect, it } from 'vitest';
import { isSolvedBy, isValidGuess, judge, poolOf, secretFor } from './engine';
import { DIFFICULTIES, POOL_FOR, SLOTS_FOR } from './types';

describe('the secret (§2)', () => {
  it.each(DIFFICULTIES)('%s: N different symbols from the pool, every seed', (difficulty) => {
    for (let n = 0; n < 200; n++) {
      const secret = secretFor(`hit-and-blow-test-${n}`, difficulty);
      expect(secret).toHaveLength(SLOTS_FOR[difficulty]);
      expect(new Set(secret).size).toBe(secret.length);
      for (const symbol of secret) {
        expect(Number.isInteger(symbol)).toBe(true);
        expect(symbol).toBeGreaterThanOrEqual(0);
        expect(symbol).toBeLessThan(POOL_FOR[difficulty]);
      }
      expect(isValidGuess(secret, difficulty)).toBe(true);
    }
  });

  it('is the same code for the same seed, and a different one for another', () => {
    expect(secretFor('same-seed', 'normal')).toEqual(secretFor('same-seed', 'normal'));
    const deals = new Set(
      Array.from({ length: 50 }, (_, n) => secretFor(`seed-${n}`, 'normal').join('')),
    );
    // Fifty seeds over 1,680 possible codes: collisions are possible, a
    // handful of repeats is not what a working shuffle produces.
    expect(deals.size).toBeGreaterThan(40);
  });

  it('only ever uses the first six symbols on easy (§1)', () => {
    const used = new Set<number>();
    for (let n = 0; n < 300; n++) for (const s of secretFor(`easy-${n}`, 'easy')) used.add(s);
    expect([...used].sort()).toEqual(poolOf('easy'));
  });
});

describe('hits and blows (§4)', () => {
  const cases: {
    secret: number[];
    guess: number[];
    hits: number;
    blows: number;
    note: string;
  }[] = [
    { secret: [0, 1, 2, 3], guess: [0, 1, 2, 3], hits: 4, blows: 0, note: 'exact' },
    { secret: [0, 1, 2, 3], guess: [3, 2, 1, 0], hits: 0, blows: 4, note: 'all moved' },
    { secret: [0, 1, 2, 3], guess: [4, 5, 6, 7], hits: 0, blows: 0, note: 'nothing shared' },
    { secret: [0, 1, 2, 3], guess: [0, 2, 5, 1], hits: 1, blows: 2, note: 'mixed' },
    { secret: [0, 1, 2, 3, 4], guess: [0, 1, 4, 5, 6], hits: 2, blows: 1, note: 'five slots' },
    // Duplicates — never produced by the UI (§2), still counted right.
    { secret: [1, 1, 2, 3], guess: [1, 2, 1, 1], hits: 1, blows: 2, note: 'repeats in both' },
    { secret: [1, 2, 3, 4], guess: [1, 1, 1, 1], hits: 1, blows: 0, note: 'guess repeats one' },
    { secret: [1, 1, 1, 1], guess: [1, 2, 3, 4], hits: 1, blows: 0, note: 'secret repeats one' },
    { secret: [1, 1, 2, 2], guess: [2, 2, 1, 1], hits: 0, blows: 4, note: 'two pairs swapped' },
    { secret: [1, 1, 2, 2], guess: [1, 2, 1, 2], hits: 2, blows: 2, note: 'pairs interleaved' },
  ];

  it.each(cases)('$note: $guess against $secret', ({ secret, guess, hits, blows }) => {
    expect(judge(secret, guess)).toEqual({ hits, blows });
  });

  it('never counts a symbol twice, whichever code holds more of it', () => {
    for (const { secret, guess } of cases) {
      const { hits, blows } = judge(secret, guess);
      expect(hits + blows).toBeLessThanOrEqual(Math.min(secret.length, guess.length));
      expect(blows).toBeGreaterThanOrEqual(0);
    }
  });

  it('is solved only by the secret itself (§5)', () => {
    expect(isSolvedBy([0, 1, 2, 3], [0, 1, 2, 3])).toBe(true);
    expect(isSolvedBy([0, 1, 2, 3], [0, 1, 3, 2])).toBe(false);
    expect(isSolvedBy([0, 1, 2, 3, 4], [0, 1, 2, 3])).toBe(false);
  });
});

describe('what a guess may be (§2, §3)', () => {
  it('accepts N different symbols inside the pool', () => {
    expect(isValidGuess([0, 1, 2, 3], 'easy')).toBe(true);
    expect(isValidGuess([7, 6, 5, 4], 'normal')).toBe(true);
    expect(isValidGuess([7, 0, 3, 5, 1], 'hard')).toBe(true);
  });

  it('refuses the wrong length', () => {
    expect(isValidGuess([0, 1, 2], 'easy')).toBe(false);
    expect(isValidGuess([0, 1, 2, 3, 4], 'normal')).toBe(false);
    expect(isValidGuess([0, 1, 2, 3], 'hard')).toBe(false);
  });

  it('refuses a symbol outside the pool', () => {
    expect(isValidGuess([0, 1, 2, 6], 'easy')).toBe(false);
    expect(isValidGuess([0, 1, 2, 8], 'normal')).toBe(false);
    expect(isValidGuess([-1, 1, 2, 3], 'normal')).toBe(false);
    expect(isValidGuess([0.5, 1, 2, 3], 'normal')).toBe(false);
    expect(isValidGuess(['0', 1, 2, 3], 'normal')).toBe(false);
  });

  it('refuses a symbol twice (§2)', () => {
    expect(isValidGuess([0, 1, 1, 3], 'easy')).toBe(false);
    expect(isValidGuess([4, 4, 4, 4, 4], 'hard')).toBe(false);
  });
});
