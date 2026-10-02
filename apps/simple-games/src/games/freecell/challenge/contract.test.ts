import { describe, expect, it } from 'vitest';
import { FREECELL_CHALLENGE } from './contract';

describe('freecell challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(FREECELL_CHALLENGE.contractVersion).toBe(1);
    expect(FREECELL_CHALLENGE.order).toBe('moves');
    expect(FREECELL_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{}]) {
      expect(FREECELL_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [null, [], 'x']) {
      expect(FREECELL_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(FREECELL_CHALLENGE.validateParams({ ...{}, extra: 1 })).toEqual({});
  });

  it("accepts the result screen's facts", () => {
    expect(FREECELL_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 95 })).toEqual({
      moves: 12,
      elapsedSeconds: 95,
    });
  });

  it('reads moves as an integer in range', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: 0 })).toEqual({ ...ok, moves: 0 });
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: 100_000 })).toEqual({
      ...ok,
      moves: 100_000,
    });
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: 100_001 })).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: -1 })).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: 1.5 })).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: '12' })).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, moves: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(FREECELL_CHALLENGE.validateFacts({ elapsedSeconds: 95 })).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts(null)).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts([])).toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('bounds the time at a day of seconds', () => {
    const ok = { moves: 12, elapsedSeconds: 95 };
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_400 })).not.toBeNull();
    expect(FREECELL_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_401 })).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(FREECELL_CHALLENGE.paramsKey({})).toBe('standard');
    expect(FREECELL_CHALLENGE.paramsKey({})).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
