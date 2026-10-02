import { describe, expect, it } from 'vitest';
import { HIT_AND_BLOW_CHALLENGE } from './contract';

describe('hit-and-blow challenge contract', () => {
  it('ranks attempts upward (fewer is better)', () => {
    expect(HIT_AND_BLOW_CHALLENGE.contractVersion).toBe(1);
    expect(HIT_AND_BLOW_CHALLENGE.order).toBe('attempts');
    expect(HIT_AND_BLOW_CHALLENGE.direction).toBe('asc');
  });

  it('accepts the params that name a table and drops anything else', () => {
    for (const raw of [{ difficulty: 'easy' }, { difficulty: 'normal' }, { difficulty: 'hard' }]) {
      expect(HIT_AND_BLOW_CHALLENGE.validateParams(raw)).toEqual(raw);
    }
    for (const raw of [{ difficulty: 'expert' }, {}, null, []]) {
      expect(HIT_AND_BLOW_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(
      HIT_AND_BLOW_CHALLENGE.validateParams({ ...{ difficulty: 'normal' }, extra: 1 }),
    ).toEqual({ difficulty: 'normal' });
  });

  it("accepts the result screen's facts", () => {
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ attempts: 7 })).toEqual({ attempts: 7 });
  });

  it('reads attempts as an integer in range', () => {
    const ok = { attempts: 7 };
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: 0 })).toEqual({
      ...ok,
      attempts: 0,
    });
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: 100_000 })).toEqual({
      ...ok,
      attempts: 100_000,
    });
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: 100_001 })).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: -1 })).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: 1.5 })).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: '12' })).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({ ...ok, attempts: Number.NaN })).toBeNull();
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts({})).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts(null)).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts([])).toBeNull();
    expect(HIT_AND_BLOW_CHALLENGE.validateFacts('12')).toBeNull();
  });

  it('names the table by paramsKey', () => {
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'easy' })).toBe('easy');
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'easy' })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'normal' })).toBe('normal');
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'normal' })).toMatch(/^[a-z0-9-]{1,40}$/);
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'hard' })).toBe('hard');
    expect(HIT_AND_BLOW_CHALLENGE.paramsKey({ difficulty: 'hard' })).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
