import { describe, expect, it } from 'vitest';
import { SLIDING_PUZZLE_CHALLENGE } from './contract';

describe('sliding-puzzle challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(SLIDING_PUZZLE_CHALLENGE.contractVersion).toBe(1);
    expect(SLIDING_PUZZLE_CHALLENGE.order).toBe('moves');
    expect(SLIDING_PUZZLE_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{ size: 3 }, { size: 4 }, { size: 5 }]) {
      expect(SLIDING_PUZZLE_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [{ size: 6 }, { size: '4' }, {}, null, []]) {
      expect(SLIDING_PUZZLE_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(SLIDING_PUZZLE_CHALLENGE.validateParams({ ...{ size: 4 }, extra: 1 })).toEqual({
      size: 4,
    });
  });

  it("accepts the result screen's facts", () => {
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 95 })).toEqual({
      moves: 12,
      elapsedSeconds: 95,
    });
  });

  it('reads moves as an integer in range', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: 0 })).toEqual({
      ...ok,
      moves: 0,
    });
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: 100_000 })).toEqual({
      ...ok,
      moves: 100_000,
    });
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: 100_001 })).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: -1 })).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: 1.5 })).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: '12' })).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, moves: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ elapsedSeconds: 95 })).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts([])).toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('bounds the time at a day of seconds', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(
      SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_400 }),
    ).not.toBeNull();
    expect(SLIDING_PUZZLE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_401 })).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 3 })).toBe('3x3');
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 3 })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 4 })).toBe('4x4');
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 4 })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 5 })).toBe('5x5');
    expect(SLIDING_PUZZLE_CHALLENGE.paramsKey({ size: 5 })).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
