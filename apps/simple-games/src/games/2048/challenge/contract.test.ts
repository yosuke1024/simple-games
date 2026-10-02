import { describe, expect, it } from 'vitest';
import { GAME_2048_CHALLENGE } from './contract';

describe('2048 challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(GAME_2048_CHALLENGE.contractVersion).toBe(1);
    expect(GAME_2048_CHALLENGE.order).toBe('score');
    expect(GAME_2048_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(GAME_2048_CHALLENGE.validateParams({})).toEqual({});
    expect(GAME_2048_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(GAME_2048_CHALLENGE.validateParams(null)).toBeNull();
    expect(GAME_2048_CHALLENGE.validateParams('standard')).toBeNull();
    expect(GAME_2048_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(GAME_2048_CHALLENGE.validateFacts({ score: 1234, bestTile: 4 })).toEqual({
      score: 1234,
      bestTile: 4,
    });
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(GAME_2048_CHALLENGE.validateFacts(null)).toBeNull();
    expect(GAME_2048_CHALLENGE.validateFacts([])).toBeNull();
    expect(GAME_2048_CHALLENGE.validateFacts({})).toBeNull();
    expect(GAME_2048_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      GAME_2048_CHALLENGE.validateFacts({ ...{ score: 1234, bestTile: 4 }, score: '12' }),
    ).toBeNull();
  });
});
