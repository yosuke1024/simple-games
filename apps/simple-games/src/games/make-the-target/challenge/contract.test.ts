/**
 * The Club House contract (docs/MAKE_THE_TARGET_RULES.md §16, docs/architecture/
 * club.md §6-1): a table per difficulty, ranked by the result card's time, and
 * nothing the card does not show.
 */
import { describe, expect, it } from 'vitest';
import { MAKE_THE_TARGET_CHALLENGE as contract } from './contract';

describe('make-the-target challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    for (const difficulty of ['easy', 'medium', 'hard']) {
      expect(contract.validateParams({ difficulty })).toEqual({ difficulty });
    }
    expect(contract.validateParams({ difficulty: 'hard', extra: 1 })).toEqual({
      difficulty: 'hard',
    });
  });

  it('accepts the daily’s params as the result card sends them (the daily is Medium, §8)', () => {
    expect(contract.validateParams({ difficulty: 'medium' })).toEqual({ difficulty: 'medium' });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams(undefined)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ difficulty: 42 })).toBeNull();
    expect(contract.validateParams({ difficulty: undefined })).toBeNull();
    expect(contract.validateParams({ difficulty: 'Medium' })).toBeNull();
    expect(contract.validateParams({ difficulty: 'daily' })).toBeNull();
    expect(contract.validateParams({ difficulty: 'expert' })).toBeNull();
  });

  it('names the ranking table in lower case, one key per difficulty', () => {
    const keys = ['easy', 'medium', 'hard'].map((difficulty) => {
      const params = contract.validateParams({ difficulty });
      expect(params).not.toBeNull();
      return contract.paramsKey(params!);
    });
    expect(keys).toEqual(['easy', 'medium', 'hard']);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it('reads the time the result card shows, and nothing else', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125 })).toEqual({ elapsedSeconds: 125 });
    expect(contract.validateFacts({ elapsedSeconds: 125, extra: 9 })).toEqual({
      elapsedSeconds: 125,
    });
  });

  it('needs the time axis, as a whole number of seconds in a day — 0 included', () => {
    expect(contract.validateFacts({})).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 12.5 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: '12' })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: Number.NaN })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: Number.POSITIVE_INFINITY })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 86_401 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 86_400 })).toEqual({ elapsedSeconds: 86_400 });
    // An Easy problem solved inside the first tick is a clear in 0:00 (§9).
    expect(contract.validateFacts({ elapsedSeconds: 0 })).toEqual({ elapsedSeconds: 0 });
  });

  it('refuses facts of the wrong shape', () => {
    expect(contract.validateFacts(null)).toBeNull();
    expect(contract.validateFacts(undefined)).toBeNull();
    expect(contract.validateFacts('x')).toBeNull();
    expect(contract.validateFacts(125)).toBeNull();
    expect(contract.validateFacts([])).toBeNull();
    expect(contract.validateFacts([125])).toBeNull();
  });
});
