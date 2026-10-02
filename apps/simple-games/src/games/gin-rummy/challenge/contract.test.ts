import { describe, expect, it } from 'vitest';
import { GIN_RUMMY_CHALLENGE } from './contract';

describe('gin-rummy challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(GIN_RUMMY_CHALLENGE.contractVersion).toBe(1);
    expect(GIN_RUMMY_CHALLENGE.order).toBe('score');
    expect(GIN_RUMMY_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each difficulty and keys the table by it', () => {
    for (const value of ['easy', 'normal', 'hard']) {
      expect(GIN_RUMMY_CHALLENGE.validateParams({ difficulty: value })).toEqual({
        difficulty: value,
      });
      expect(GIN_RUMMY_CHALLENGE.paramsKey({ difficulty: value })).toBe(value);
    }
  });

  it('refuses params that do not fit', () => {
    expect(GIN_RUMMY_CHALLENGE.validateParams({ difficulty: 'nope' })).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateParams({})).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateParams(null)).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateParams('easy')).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(GIN_RUMMY_CHALLENGE.validateFacts({ score: 1234, cpuScore: 4 })).toEqual({
      score: 1234,
      cpuScore: 4,
    });
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(GIN_RUMMY_CHALLENGE.validateFacts(null)).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateFacts([])).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateFacts({})).toBeNull();
    expect(GIN_RUMMY_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      GIN_RUMMY_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: '12' }),
    ).toBeNull();
  });
});
