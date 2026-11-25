import { describe, expect, it } from 'vitest';
import { SCOPA_CHALLENGE } from './contract';

describe('scopa challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(SCOPA_CHALLENGE.contractVersion).toBe(1);
    expect(SCOPA_CHALLENGE.order).toBe('score');
    expect(SCOPA_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(SCOPA_CHALLENGE.validateParams({})).toEqual({});
    expect(SCOPA_CHALLENGE.paramsKey({})).toBe('standard');
    // Anything extra a client sends is dropped, never carried into the key.
    expect(SCOPA_CHALLENGE.validateParams({ difficulty: 'hard' })).toEqual({});
  });

  it('refuses params that are not an object', () => {
    expect(SCOPA_CHALLENGE.validateParams(null)).toBeNull();
    expect(SCOPA_CHALLENGE.validateParams(undefined)).toBeNull();
    expect(SCOPA_CHALLENGE.validateParams('standard')).toBeNull();
    expect(SCOPA_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the CPU’s', () => {
    expect(SCOPA_CHALLENGE.validateFacts({ score: 12, cpuScore: 9 })).toEqual({
      score: 12,
      cpuScore: 9,
    });
    // A lost match is still ranked by its score (docs/SCOPA_RULES.md §17).
    expect(SCOPA_CHALLENGE.validateFacts({ score: 7, cpuScore: 11 })).toEqual({
      score: 7,
      cpuScore: 11,
    });
    expect(SCOPA_CHALLENGE.validateFacts({ score: 0, cpuScore: 11 })).toMatchObject({ score: 0 });
    expect(
      SCOPA_CHALLENGE.validateFacts({ score: 1_000_000_000, cpuScore: 1_000_000_000 }),
    ).toEqual({ score: 1_000_000_000, cpuScore: 1_000_000_000 });
  });

  it('keeps only the two figures', () => {
    expect(SCOPA_CHALLENGE.validateFacts({ score: 12, cpuScore: 9, extra: 1 })).toEqual({
      score: 12,
      cpuScore: 9,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(SCOPA_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SCOPA_CHALLENGE.validateFacts([])).toBeNull();
    expect(SCOPA_CHALLENGE.validateFacts({})).toBeNull();
    expect(SCOPA_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(SCOPA_CHALLENGE.validateFacts({ cpuScore: 1 })).toBeNull();
    for (const bad of [1.5, -1, 1_000_000_001, '12', NaN, Infinity, null]) {
      expect(SCOPA_CHALLENGE.validateFacts({ score: bad, cpuScore: 9 })).toBeNull();
      expect(SCOPA_CHALLENGE.validateFacts({ score: 12, cpuScore: bad })).toBeNull();
    }
  });
});
