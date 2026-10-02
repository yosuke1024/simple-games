import { describe, expect, it } from 'vitest';
import { BRICK_BREAKER_CHALLENGE } from './contract';

describe('brick-breaker challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(BRICK_BREAKER_CHALLENGE.contractVersion).toBe(1);
    expect(BRICK_BREAKER_CHALLENGE.order).toBe('score');
    expect(BRICK_BREAKER_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(BRICK_BREAKER_CHALLENGE.validateParams({})).toEqual({});
    expect(BRICK_BREAKER_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(BRICK_BREAKER_CHALLENGE.validateParams(null)).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateParams('standard')).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({ score: 1234 })).toEqual({ score: 1234 });
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 0 })).toMatchObject({
      score: 0,
    });
    expect(
      BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(BRICK_BREAKER_CHALLENGE.validateFacts(null)).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateFacts([])).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({})).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1.5 })).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: -1 })).toBeNull();
    expect(
      BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(BRICK_BREAKER_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: '12' })).toBeNull();
  });
});
