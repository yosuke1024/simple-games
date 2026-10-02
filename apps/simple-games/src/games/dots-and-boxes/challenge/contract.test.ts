import { describe, expect, it } from 'vitest';
import { DOTS_AND_BOXES_CHALLENGE } from './contract';

describe('dots-and-boxes challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(DOTS_AND_BOXES_CHALLENGE.contractVersion).toBe(1);
    expect(DOTS_AND_BOXES_CHALLENGE.order).toBe('score');
    expect(DOTS_AND_BOXES_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each size and keys the table by it', () => {
    for (const value of ['small', 'medium', 'large']) {
      expect(DOTS_AND_BOXES_CHALLENGE.validateParams({ size: value })).toEqual({ size: value });
      expect(DOTS_AND_BOXES_CHALLENGE.paramsKey({ size: value })).toBe(value);
    }
  });

  it('refuses params that do not fit', () => {
    expect(DOTS_AND_BOXES_CHALLENGE.validateParams({ size: 'nope' })).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateParams({})).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateParams(null)).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateParams('small')).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(DOTS_AND_BOXES_CHALLENGE.validateFacts({ score: 1234, cpuScore: 4 })).toEqual({
      score: 1234,
      cpuScore: 4,
    });
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({
        ...{ score: 1234, cpuScore: 4 },
        score: 1_000_000_000,
      }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(DOTS_AND_BOXES_CHALLENGE.validateFacts(null)).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateFacts([])).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateFacts({})).toBeNull();
    expect(DOTS_AND_BOXES_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({
        ...{ score: 1234, cpuScore: 4 },
        score: 1_000_000_001,
      }),
    ).toBeNull();
    expect(
      DOTS_AND_BOXES_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: '12' }),
    ).toBeNull();
  });
});
