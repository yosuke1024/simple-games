import { describe, expect, it } from 'vitest';
import { NONOGRAM_CHALLENGE as contract } from './contract';

describe('nonogram challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ size: 10 })).toEqual({ size: 10 });
    expect(contract.validateParams({ ...{ size: 10 }, extra: 1 })).toEqual({ size: 10 });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ ...{ size: 10 }, size: '5' })).toBeNull();
    expect(contract.validateParams({ ...{ size: 10 }, size: undefined })).toBeNull();
  });

  it('names the ranking table in lower case', () => {
    const params = contract.validateParams({ size: 10 });
    expect(params).not.toBeNull();
    expect(contract.paramsKey(params!)).toBe('10x10');
    for (const value of [5, 10]) {
      const key = contract.paramsKey({ size: value });
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the figures the result screen shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 2 })).toEqual({
      elapsedSeconds: 125,
      hints: 2,
    });
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 2, extra: 9 })).toEqual({
      elapsedSeconds: 125,
      hints: 2,
    });
  });

  it('needs the time axis, as a whole number of seconds in a day', () => {
    const rest = { hints: 2 };
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
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 100_001 })).toBeNull();
  });
});
