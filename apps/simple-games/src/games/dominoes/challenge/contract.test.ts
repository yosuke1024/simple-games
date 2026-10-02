import { describe, expect, it } from 'vitest';
import { DOMINOES_CHALLENGE } from './contract';

describe('dominoes challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(DOMINOES_CHALLENGE.contractVersion).toBe(1);
    expect(DOMINOES_CHALLENGE.order).toBe('score');
    expect(DOMINOES_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(DOMINOES_CHALLENGE.validateParams({})).toEqual({});
    expect(DOMINOES_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(DOMINOES_CHALLENGE.validateParams(null)).toBeNull();
    expect(DOMINOES_CHALLENGE.validateParams('standard')).toBeNull();
    expect(DOMINOES_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(DOMINOES_CHALLENGE.validateFacts({ score: 1234, playerPips: 4, cpuPips: 5 })).toEqual({
      score: 1234,
      playerPips: 4,
      cpuPips: 5,
    });
    expect(
      DOMINOES_CHALLENGE.validateFacts({ ...{ score: 1234, playerPips: 4, cpuPips: 5 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      DOMINOES_CHALLENGE.validateFacts({
        ...{ score: 1234, playerPips: 4, cpuPips: 5 },
        score: 1_000_000_000,
      }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(DOMINOES_CHALLENGE.validateFacts(null)).toBeNull();
    expect(DOMINOES_CHALLENGE.validateFacts([])).toBeNull();
    expect(DOMINOES_CHALLENGE.validateFacts({})).toBeNull();
    expect(DOMINOES_CHALLENGE.validateFacts({ score: 1, playerPips: 1 })).toBeNull();
    expect(
      DOMINOES_CHALLENGE.validateFacts({
        ...{ score: 1234, playerPips: 4, cpuPips: 5 },
        score: 1.5,
      }),
    ).toBeNull();
    expect(
      DOMINOES_CHALLENGE.validateFacts({
        ...{ score: 1234, playerPips: 4, cpuPips: 5 },
        score: -1,
      }),
    ).toBeNull();
    expect(
      DOMINOES_CHALLENGE.validateFacts({
        ...{ score: 1234, playerPips: 4, cpuPips: 5 },
        score: 1_000_000_001,
      }),
    ).toBeNull();
    expect(
      DOMINOES_CHALLENGE.validateFacts({
        ...{ score: 1234, playerPips: 4, cpuPips: 5 },
        score: '12',
      }),
    ).toBeNull();
  });
});
