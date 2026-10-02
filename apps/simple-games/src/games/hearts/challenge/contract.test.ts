import { describe, expect, it } from 'vitest';
import { HEARTS_CHALLENGE } from './contract';

describe('hearts challenge contract', () => {
  it('is a score table (lower is better)', () => {
    expect(HEARTS_CHALLENGE.contractVersion).toBe(1);
    expect(HEARTS_CHALLENGE.order).toBe('score');
    expect(HEARTS_CHALLENGE.direction).toBe('asc');
  });

  it('accepts each difficulty and keys the table by it', () => {
    for (const value of ['easy', 'normal', 'hard']) {
      expect(HEARTS_CHALLENGE.validateParams({ difficulty: value })).toEqual({ difficulty: value });
      expect(HEARTS_CHALLENGE.paramsKey({ difficulty: value })).toBe(value);
    }
  });

  it('refuses params that do not fit', () => {
    expect(HEARTS_CHALLENGE.validateParams({ difficulty: 'nope' })).toBeNull();
    expect(HEARTS_CHALLENGE.validateParams({})).toBeNull();
    expect(HEARTS_CHALLENGE.validateParams(null)).toBeNull();
    expect(HEARTS_CHALLENGE.validateParams('easy')).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(HEARTS_CHALLENGE.validateFacts({ score: 1234 })).toEqual({ score: 1234 });
    expect(HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 0 })).toMatchObject({
      score: 0,
    });
    expect(
      HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(HEARTS_CHALLENGE.validateFacts(null)).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts([])).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts({})).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1.5 })).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: -1 })).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_001 })).toBeNull();
    expect(HEARTS_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: '12' })).toBeNull();
  });
});
