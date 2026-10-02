import { describe, expect, it } from 'vitest';
import { SUDOKU_6X6_CHALLENGE as contract } from './contract';

describe('sudoku-6x6 challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ difficulty: 'hard' })).toEqual({ difficulty: 'hard' });
    expect(contract.validateParams({ ...{ difficulty: 'hard' }, extra: 1 })).toEqual({
      difficulty: 'hard',
    });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ ...{ difficulty: 'hard' }, difficulty: 42 })).toBeNull();
    expect(
      contract.validateParams({ ...{ difficulty: 'hard' }, difficulty: undefined }),
    ).toBeNull();
  });

  it('names the ranking table in lower case', () => {
    const params = contract.validateParams({ difficulty: 'hard' });
    expect(params).not.toBeNull();
    expect(contract.paramsKey(params!)).toBe('hard');
    for (const value of ['easy', 'medium', 'hard']) {
      const key = contract.paramsKey({ difficulty: value });
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the figures the result screen shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 2, hints: 3 })).toEqual({
      elapsedSeconds: 125,
      mistakes: 2,
      hints: 3,
    });
    expect(
      contract.validateFacts({ elapsedSeconds: 125, mistakes: 2, hints: 3, extra: 9 }),
    ).toEqual({ elapsedSeconds: 125, mistakes: 2, hints: 3 });
  });

  it('needs the time axis, as a whole number of seconds in a day', () => {
    const rest = { mistakes: 2, hints: 3 };
    expect(contract.validateFacts(rest)).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 12.5 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: -1 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: '12' })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 86_401 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 86_400 })).toMatchObject({
      elapsedSeconds: 86_400,
    });
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 0 })).toMatchObject({
      elapsedSeconds: 0,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(contract.validateFacts(null)).toBeNull();
    expect(contract.validateFacts('x')).toBeNull();
    expect(contract.validateFacts([])).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: -1, hints: 3 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 100_001, hints: 3 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 2, hints: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 2, hints: 100_001 })).toBeNull();
  });
});
