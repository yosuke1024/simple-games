import { describe, expect, it } from 'vitest';
import { MANCALA_CHALLENGE } from './contract';

describe('mancala challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(MANCALA_CHALLENGE.contractVersion).toBe(1);
    expect(MANCALA_CHALLENGE.order).toBe('score');
    expect(MANCALA_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each difficulty and keys the table by it', () => {
    for (const value of ['easy', 'normal', 'hard']) {
      expect(MANCALA_CHALLENGE.validateParams({ difficulty: value })).toEqual({
        difficulty: value,
      });
      expect(MANCALA_CHALLENGE.paramsKey({ difficulty: value })).toBe(value);
    }
  });

  it('refuses params that do not fit', () => {
    expect(MANCALA_CHALLENGE.validateParams({ difficulty: 'nope' })).toBeNull();
    expect(MANCALA_CHALLENGE.validateParams({})).toBeNull();
    expect(MANCALA_CHALLENGE.validateParams(null)).toBeNull();
    expect(MANCALA_CHALLENGE.validateParams('easy')).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(MANCALA_CHALLENGE.validateFacts({ score: 1234, cpuScore: 4 })).toEqual({
      score: 1234,
      cpuScore: 4,
    });
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(MANCALA_CHALLENGE.validateFacts(null)).toBeNull();
    expect(MANCALA_CHALLENGE.validateFacts([])).toBeNull();
    expect(MANCALA_CHALLENGE.validateFacts({})).toBeNull();
    expect(MANCALA_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      MANCALA_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: '12' }),
    ).toBeNull();
  });
});
