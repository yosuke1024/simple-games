import { describe, expect, it } from 'vitest';
import { BUNNY_HOP_CHALLENGE } from './contract';

describe('bunny-hop challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(BUNNY_HOP_CHALLENGE.contractVersion).toBe(1);
    expect(BUNNY_HOP_CHALLENGE.order).toBe('score');
    expect(BUNNY_HOP_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(BUNNY_HOP_CHALLENGE.validateParams({})).toEqual({});
    expect(BUNNY_HOP_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(BUNNY_HOP_CHALLENGE.validateParams(null)).toBeNull();
    expect(BUNNY_HOP_CHALLENGE.validateParams('standard')).toBeNull();
    expect(BUNNY_HOP_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(BUNNY_HOP_CHALLENGE.validateFacts({ score: 1234, obstaclesPassed: 4 })).toEqual({
      score: 1234,
      obstaclesPassed: 4,
    });
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({ ...{ score: 1234, obstaclesPassed: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({
        ...{ score: 1234, obstaclesPassed: 4 },
        score: 1_000_000_000,
      }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(BUNNY_HOP_CHALLENGE.validateFacts(null)).toBeNull();
    expect(BUNNY_HOP_CHALLENGE.validateFacts([])).toBeNull();
    expect(BUNNY_HOP_CHALLENGE.validateFacts({})).toBeNull();
    expect(BUNNY_HOP_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({ ...{ score: 1234, obstaclesPassed: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({ ...{ score: 1234, obstaclesPassed: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({
        ...{ score: 1234, obstaclesPassed: 4 },
        score: 1_000_000_001,
      }),
    ).toBeNull();
    expect(
      BUNNY_HOP_CHALLENGE.validateFacts({ ...{ score: 1234, obstaclesPassed: 4 }, score: '12' }),
    ).toBeNull();
  });
});
