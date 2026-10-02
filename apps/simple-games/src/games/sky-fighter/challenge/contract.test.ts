import { describe, expect, it } from 'vitest';
import { SKY_FIGHTER_CHALLENGE } from './contract';

describe('sky-fighter challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(SKY_FIGHTER_CHALLENGE.contractVersion).toBe(1);
    expect(SKY_FIGHTER_CHALLENGE.order).toBe('score');
    expect(SKY_FIGHTER_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(SKY_FIGHTER_CHALLENGE.validateParams({})).toEqual({});
    expect(SKY_FIGHTER_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(SKY_FIGHTER_CHALLENGE.validateParams(null)).toBeNull();
    expect(SKY_FIGHTER_CHALLENGE.validateParams('standard')).toBeNull();
    expect(SKY_FIGHTER_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(SKY_FIGHTER_CHALLENGE.validateFacts({ score: 1234, stage: 4 })).toEqual({
      score: 1234,
      stage: 4,
    });
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(SKY_FIGHTER_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SKY_FIGHTER_CHALLENGE.validateFacts([])).toBeNull();
    expect(SKY_FIGHTER_CHALLENGE.validateFacts({})).toBeNull();
    expect(SKY_FIGHTER_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      SKY_FIGHTER_CHALLENGE.validateFacts({ ...{ score: 1234, stage: 4 }, score: '12' }),
    ).toBeNull();
  });
});
