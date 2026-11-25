import { describe, expect, it } from 'vitest';
import { COLOR_COUNTS, MAX_ROUND_SCORE } from '../game';
import { GEM_SWAP_CHALLENGE } from './contract';

describe('gem-swap challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(GEM_SWAP_CHALLENGE.contractVersion).toBe(1);
    expect(GEM_SWAP_CHALLENGE.order).toBe('score');
    expect(GEM_SWAP_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each gem count the game has and keys the table by its word', () => {
    expect(COLOR_COUNTS).toEqual([5, 6]);
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 5 })).toEqual({ colors: 5 });
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 6 })).toEqual({ colors: 6 });
    expect(GEM_SWAP_CHALLENGE.paramsKey({ colors: 5 })).toBe('easy');
    expect(GEM_SWAP_CHALLENGE.paramsKey({ colors: 6 })).toBe('normal');
    for (const colors of COLOR_COUNTS) {
      expect(GEM_SWAP_CHALLENGE.paramsKey({ colors })).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('keeps only the gem count from the params', () => {
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 6, extra: 1 })).toEqual({ colors: 6 });
  });

  it('refuses params that do not fit', () => {
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 4 })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 7 })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: '6' })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 5.5 })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams({ colors: 'normal' })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams({})).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams(null)).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams(6)).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, from 0 to the most a round could score', () => {
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: 211 })).toEqual({ score: 211 });
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: 0 })).toEqual({ score: 0 });
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: MAX_ROUND_SCORE })).toEqual({
      score: MAX_ROUND_SCORE,
    });
  });

  it('bounds the score at the game’s own ceiling (a literal, since the contract imports nothing)', () => {
    expect(MAX_ROUND_SCORE).toBe(122_880);
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: MAX_ROUND_SCORE + 1 })).toBeNull();
  });

  it('keeps only the score from the facts (the gem count is the table, not a fact)', () => {
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: 7, colors: 6 })).toEqual({ score: 7 });
  });

  it('refuses facts of the wrong shape', () => {
    expect(GEM_SWAP_CHALLENGE.validateFacts(null)).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts([])).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({})).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts('211')).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: 1.5 })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: -1 })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: '12' })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: Number.NaN })).toBeNull();
    expect(GEM_SWAP_CHALLENGE.validateFacts({ score: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
