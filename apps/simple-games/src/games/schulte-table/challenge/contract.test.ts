import { describe, expect, it } from 'vitest';
import { SCHULTE_TABLE_CHALLENGE as contract } from './contract';

describe('schulte-table challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ size: 5, order: 'oddThenEven' })).toEqual({
      size: 5,
      order: 'oddThenEven',
    });
    expect(contract.validateParams({ ...{ size: 5, order: 'oddThenEven' }, extra: 1 })).toEqual({
      size: 5,
      order: 'oddThenEven',
    });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ ...{ size: 5, order: 'oddThenEven' }, size: '3' })).toBeNull();
    expect(
      contract.validateParams({ ...{ size: 5, order: 'oddThenEven' }, size: undefined }),
    ).toBeNull();
    expect(contract.validateParams({ size: 3 })).toBeNull();
  });

  it('names the ranking table in lower case', () => {
    const params = contract.validateParams({ size: 5, order: 'oddThenEven' });
    expect(params).not.toBeNull();
    expect(contract.paramsKey(params!)).toBe('5x5-odd-then-even');
    for (const [size, order] of [
      [3, 'ascending'],
      [3, 'descending'],
      [3, 'oddThenEven'],
      [4, 'ascending'],
      [4, 'descending'],
      [4, 'oddThenEven'],
      [5, 'ascending'],
      [5, 'descending'],
      [5, 'oddThenEven'],
    ] as const) {
      const key = contract.paramsKey({ size, order });
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the figures the result screen shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 2 })).toEqual({
      elapsedSeconds: 125,
      mistakes: 2,
    });
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 2, extra: 9 })).toEqual({
      elapsedSeconds: 125,
      mistakes: 2,
    });
  });

  it('needs the time axis, as a whole number of seconds in a day', () => {
    const rest = { mistakes: 2 };
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
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, mistakes: 100_001 })).toBeNull();
  });
});
