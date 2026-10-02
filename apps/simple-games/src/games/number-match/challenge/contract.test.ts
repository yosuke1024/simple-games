import { describe, expect, it } from 'vitest';
import { NUMBER_MATCH_CHALLENGE } from './contract';

describe('number-match challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(NUMBER_MATCH_CHALLENGE.contractVersion).toBe(1);
    expect(NUMBER_MATCH_CHALLENGE.order).toBe('moves');
    expect(NUMBER_MATCH_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{}]) {
      expect(NUMBER_MATCH_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [null, [], 'x']) {
      expect(NUMBER_MATCH_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(NUMBER_MATCH_CHALLENGE.validateParams({ ...{}, extra: 1 })).toEqual({});
  });

  it("accepts the result screen's facts", () => {
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 95 })).toEqual({
      moves: 12,
      elapsedSeconds: 95,
    });
  });

  it('reads moves as an integer in range', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: 0 })).toEqual({ ...ok, moves: 0 });
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: 100_000 })).toEqual({
      ...ok,
      moves: 100_000,
    });
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: 100_001 })).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: -1 })).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: 1.5 })).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: '12' })).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, moves: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ elapsedSeconds: 95 })).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts(null)).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts([])).toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('bounds the time at a day of seconds', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_400 })).not.toBeNull();
    expect(NUMBER_MATCH_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_401 })).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(NUMBER_MATCH_CHALLENGE.paramsKey({})).toBe('standard');
    expect(NUMBER_MATCH_CHALLENGE.paramsKey({})).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
