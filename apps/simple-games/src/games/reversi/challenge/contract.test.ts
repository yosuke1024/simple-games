import { describe, expect, it } from 'vitest';
import { REVERSI_CHALLENGE } from './contract';

describe('reversi challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(REVERSI_CHALLENGE.contractVersion).toBe(1);
    expect(REVERSI_CHALLENGE.order).toBe('score');
    expect(REVERSI_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each difficulty and keys the table by it', () => {
    for (const value of ['easy', 'normal', 'hard']) {
      expect(REVERSI_CHALLENGE.validateParams({ difficulty: value })).toEqual({
        difficulty: value,
      });
      expect(REVERSI_CHALLENGE.paramsKey({ difficulty: value })).toBe(value);
    }
  });

  it('refuses params that do not fit', () => {
    expect(REVERSI_CHALLENGE.validateParams({ difficulty: 'nope' })).toBeNull();
    expect(REVERSI_CHALLENGE.validateParams({})).toBeNull();
    expect(REVERSI_CHALLENGE.validateParams(null)).toBeNull();
    expect(REVERSI_CHALLENGE.validateParams('easy')).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(REVERSI_CHALLENGE.validateFacts({ score: 1234, cpuScore: 4 })).toEqual({
      score: 1234,
      cpuScore: 4,
    });
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(REVERSI_CHALLENGE.validateFacts(null)).toBeNull();
    expect(REVERSI_CHALLENGE.validateFacts([])).toBeNull();
    expect(REVERSI_CHALLENGE.validateFacts({})).toBeNull();
    expect(REVERSI_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      REVERSI_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: '12' }),
    ).toBeNull();
  });
});
