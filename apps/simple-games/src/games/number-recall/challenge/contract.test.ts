import { describe, expect, it } from 'vitest';
import { NUMBER_RECALL_CHALLENGE } from './contract';

describe('number-recall challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(NUMBER_RECALL_CHALLENGE.contractVersion).toBe(1);
    expect(NUMBER_RECALL_CHALLENGE.order).toBe('score');
    expect(NUMBER_RECALL_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(NUMBER_RECALL_CHALLENGE.validateParams({})).toEqual({});
    expect(NUMBER_RECALL_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(NUMBER_RECALL_CHALLENGE.validateParams(null)).toBeNull();
    expect(NUMBER_RECALL_CHALLENGE.validateParams('standard')).toBeNull();
    expect(NUMBER_RECALL_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(NUMBER_RECALL_CHALLENGE.validateFacts({ score: 1234, elapsedSeconds: 4 })).toEqual({
      score: 1234,
      elapsedSeconds: 4,
    });
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({ ...{ score: 1234, elapsedSeconds: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({
        ...{ score: 1234, elapsedSeconds: 4 },
        score: 1_000_000_000,
      }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(NUMBER_RECALL_CHALLENGE.validateFacts(null)).toBeNull();
    expect(NUMBER_RECALL_CHALLENGE.validateFacts([])).toBeNull();
    expect(NUMBER_RECALL_CHALLENGE.validateFacts({})).toBeNull();
    expect(NUMBER_RECALL_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({ ...{ score: 1234, elapsedSeconds: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({ ...{ score: 1234, elapsedSeconds: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({
        ...{ score: 1234, elapsedSeconds: 4 },
        score: 1_000_000_001,
      }),
    ).toBeNull();
    expect(
      NUMBER_RECALL_CHALLENGE.validateFacts({ ...{ score: 1234, elapsedSeconds: 4 }, score: '12' }),
    ).toBeNull();
  });
});
