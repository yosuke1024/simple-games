import { describe, expect, it } from 'vitest';
import { BUBBLE_POP_CHALLENGE } from './contract';

describe('bubble-pop challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(BUBBLE_POP_CHALLENGE.contractVersion).toBe(1);
    expect(BUBBLE_POP_CHALLENGE.order).toBe('score');
    expect(BUBBLE_POP_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(BUBBLE_POP_CHALLENGE.validateParams({})).toEqual({});
    expect(BUBBLE_POP_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(BUBBLE_POP_CHALLENGE.validateParams(null)).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateParams('standard')).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(BUBBLE_POP_CHALLENGE.validateFacts({ score: 1234 })).toEqual({ score: 1234 });
    expect(BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 0 })).toMatchObject({
      score: 0,
    });
    expect(
      BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(BUBBLE_POP_CHALLENGE.validateFacts(null)).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateFacts([])).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateFacts({})).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1.5 })).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: -1 })).toBeNull();
    expect(
      BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(BUBBLE_POP_CHALLENGE.validateFacts({ ...{ score: 1234 }, score: '12' })).toBeNull();
  });
});
