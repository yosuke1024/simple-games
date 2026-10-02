import { describe, expect, it } from 'vitest';
import { YACHT_CHALLENGE } from './contract';

describe('yacht challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(YACHT_CHALLENGE.contractVersion).toBe(1);
    expect(YACHT_CHALLENGE.order).toBe('score');
    expect(YACHT_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(YACHT_CHALLENGE.validateParams({})).toEqual({});
    expect(YACHT_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(YACHT_CHALLENGE.validateParams(null)).toBeNull();
    expect(YACHT_CHALLENGE.validateParams('standard')).toBeNull();
    expect(YACHT_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(YACHT_CHALLENGE.validateFacts({ score: 1234, cpuScore: 4 })).toEqual({
      score: 1234,
      cpuScore: 4,
    });
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(YACHT_CHALLENGE.validateFacts(null)).toBeNull();
    expect(YACHT_CHALLENGE.validateFacts([])).toBeNull();
    expect(YACHT_CHALLENGE.validateFacts({})).toBeNull();
    expect(YACHT_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      YACHT_CHALLENGE.validateFacts({ ...{ score: 1234, cpuScore: 4 }, score: '12' }),
    ).toBeNull();
  });
});
