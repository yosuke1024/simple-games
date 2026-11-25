import { describe, expect, it } from 'vitest';
import { TANGRAM_CHALLENGE as contract } from './contract';

/** The game's tiers (game/catalog.ts `TIERS`), written out: the leaf's test loads no game. */
const TIERS = ['easy', 'medium', 'hard'] as const;

describe('tangram challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ tier: 'hard' })).toEqual({ tier: 'hard' });
    expect(contract.validateParams({ ...{ tier: 'hard' }, extra: 1 })).toEqual({ tier: 'hard' });
  });

  it('accepts every tier the game has — the daily’s Medium included (§6)', () => {
    for (const tier of TIERS) expect(contract.validateParams({ tier })).toEqual({ tier });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ tier: 'daily' })).toBeNull();
    expect(contract.validateParams({ tier: 'Medium' })).toBeNull();
    expect(contract.validateParams({ tier: 42 })).toBeNull();
    expect(contract.validateParams({ tier: undefined })).toBeNull();
    expect(contract.validateParams({ difficulty: 'medium' })).toBeNull();
  });

  it('names the ranking table in lower case', () => {
    const params = contract.validateParams({ tier: 'hard' });
    expect(params).not.toBeNull();
    expect(contract.paramsKey(params!)).toBe('hard');
    for (const tier of TIERS) {
      const key = contract.paramsKey({ tier });
      expect(key).toBe(tier);
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the one figure the result card shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125 })).toEqual({ elapsedSeconds: 125 });
    expect(contract.validateFacts({ elapsedSeconds: 125, extra: 9 })).toEqual({
      elapsedSeconds: 125,
    });
  });

  it('needs the time axis, as a whole number of seconds in a day', () => {
    expect(contract.validateFacts({})).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 12.5 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: '12' })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: Number.NaN })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: Number.POSITIVE_INFINITY })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 86_401 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 86_400 })).toEqual({ elapsedSeconds: 86_400 });
    expect(contract.validateFacts({ elapsedSeconds: 0 })).toEqual({ elapsedSeconds: 0 });
  });

  it('refuses facts of the wrong shape', () => {
    expect(contract.validateFacts(null)).toBeNull();
    expect(contract.validateFacts('x')).toBeNull();
    expect(contract.validateFacts([])).toBeNull();
    expect(contract.validateFacts([125])).toBeNull();
  });
});
