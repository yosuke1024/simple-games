import { describe, expect, it } from 'vitest';
import { SOLITAIRE_CHALLENGE } from './contract';

describe('solitaire challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(SOLITAIRE_CHALLENGE.contractVersion).toBe(1);
    expect(SOLITAIRE_CHALLENGE.order).toBe('moves');
    expect(SOLITAIRE_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{ drawThree: true }, { drawThree: false }]) {
      expect(SOLITAIRE_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [{ drawThree: 'yes' }, {}, null, []]) {
      expect(SOLITAIRE_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(SOLITAIRE_CHALLENGE.validateParams({ ...{ drawThree: true }, extra: 1 })).toEqual({
      drawThree: true,
    });
  });

  it("accepts the result screen's facts", () => {
    expect(SOLITAIRE_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 95, hints: 2 })).toEqual({
      moves: 12,
      elapsedSeconds: 95,
      hints: 2,
    });
  });

  it('reads moves as an integer in range', () => {
    const ok = { moves: 12, elapsedSeconds: 95, hints: 2 };
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 0 })).toEqual({ ...ok, moves: 0 });
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 100_000 })).toEqual({
      ...ok,
      moves: 100_000,
    });
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 100_001 })).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: -1 })).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 1.5 })).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: '12' })).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(SOLITAIRE_CHALLENGE.validateFacts({ elapsedSeconds: 95, hints: 2 })).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts([])).toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('bounds the time at a day of seconds', () => {
    const ok = { moves: 12, elapsedSeconds: 95, hints: 2 };
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_400 })).not.toBeNull();
    expect(SOLITAIRE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_401 })).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(SOLITAIRE_CHALLENGE.paramsKey({ drawThree: false })).toBe('draw-1');
    expect(SOLITAIRE_CHALLENGE.paramsKey({ drawThree: false })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(SOLITAIRE_CHALLENGE.paramsKey({ drawThree: true })).toBe('draw-3');
    expect(SOLITAIRE_CHALLENGE.paramsKey({ drawThree: true })).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
