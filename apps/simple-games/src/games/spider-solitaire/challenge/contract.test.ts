import { describe, expect, it } from 'vitest';
import { SPIDER_SOLITAIRE_CHALLENGE } from './contract';

describe('spider-solitaire challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(SPIDER_SOLITAIRE_CHALLENGE.contractVersion).toBe(1);
    expect(SPIDER_SOLITAIRE_CHALLENGE.order).toBe('moves');
    expect(SPIDER_SOLITAIRE_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{ suitCount: 1 }, { suitCount: 2 }, { suitCount: 4 }]) {
      expect(SPIDER_SOLITAIRE_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [{ suitCount: 3 }, { suitCount: '1' }, {}, null]) {
      expect(SPIDER_SOLITAIRE_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateParams({ ...{ suitCount: 2 }, extra: 1 })).toEqual({
      suitCount: 2,
    });
  });

  it("accepts the result screen's facts", () => {
    expect(
      SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 95, hints: 2 }),
    ).toEqual({ moves: 12, elapsedSeconds: 95, hints: 2 });
  });

  it('reads moves as an integer in range', () => {
    const ok = { moves: 12, elapsedSeconds: 95, hints: 2 };
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 0 })).toEqual({
      ...ok,
      moves: 0,
    });
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 100_000 })).toEqual({
      ...ok,
      moves: 100_000,
    });
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 100_001 })).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: -1 })).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: 1.5 })).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: '12' })).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, moves: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ elapsedSeconds: 95, hints: 2 })).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts([])).toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('bounds the time at a day of seconds', () => {
    const ok = { moves: 12, elapsedSeconds: 95, hints: 2 };
    expect(
      SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_400 }),
    ).not.toBeNull();
    expect(SPIDER_SOLITAIRE_CHALLENGE.validateFacts({ ...ok, elapsedSeconds: 86_401 })).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 1 })).toBe('1-suit');
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 1 })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 2 })).toBe('2-suits');
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 2 })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 4 })).toBe('4-suits');
    expect(SPIDER_SOLITAIRE_CHALLENGE.paramsKey({ suitCount: 4 })).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
