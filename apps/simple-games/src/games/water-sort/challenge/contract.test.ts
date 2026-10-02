import { describe, expect, it } from 'vitest';
import { WATER_SORT_CHALLENGE as contract } from './contract';

describe('water-sort challenge contract', () => {
  it('ranks by moves, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('moves');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the ranking tiers and the daily, and drops anything else', () => {
    for (const tier of ['easy', 'medium', 'hard', 'daily']) {
      expect(contract.validateParams({ tier })).toEqual({ tier });
    }
    expect(contract.validateParams({ tier: 'hard', extra: 1 })).toEqual({ tier: 'hard' });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ tier: 'expert' })).toBeNull();
    expect(contract.validateParams({ tier: 42 })).toBeNull();
  });

  it('names the table, or the daily board kind, in lower case', () => {
    for (const tier of ['easy', 'medium', 'hard', 'daily']) {
      const key = contract.paramsKey({ tier });
      expect(key).toBe(tier);
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the figures the result screen shows', () => {
    expect(contract.validateFacts({ moves: 23, elapsedSeconds: 125, hints: 0 })).toEqual({
      moves: 23,
      elapsedSeconds: 125,
      hints: 0,
    });
    expect(contract.validateFacts({ moves: 23, elapsedSeconds: 125 })).toBeNull();
    expect(contract.validateFacts({ moves: -1, elapsedSeconds: 1, hints: 0 })).toBeNull();
    expect(contract.validateFacts(null)).toBeNull();
  });
});
