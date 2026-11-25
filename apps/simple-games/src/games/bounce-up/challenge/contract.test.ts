import { describe, expect, it } from 'vitest';
import { WIDTHS } from '../storage/schemas';
import { BOUNCE_UP_CHALLENGE } from './contract';

describe('bounce-up challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(BOUNCE_UP_CHALLENGE.contractVersion).toBe(1);
    expect(BOUNCE_UP_CHALLENGE.order).toBe('score');
    expect(BOUNCE_UP_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each width the game has and keys the table by it', () => {
    expect(WIDTHS).toEqual(['normal', 'wide']);
    for (const width of WIDTHS) {
      expect(BOUNCE_UP_CHALLENGE.validateParams({ width })).toEqual({ width });
      const key = BOUNCE_UP_CHALLENGE.paramsKey({ width });
      expect(key).toBe(width);
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('keeps only the width from the params', () => {
    expect(BOUNCE_UP_CHALLENGE.validateParams({ width: 'wide', seed: 'x' })).toEqual({
      width: 'wide',
    });
  });

  it('refuses params that do not fit', () => {
    expect(BOUNCE_UP_CHALLENGE.validateParams({ width: 'narrow' })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams({ width: 'Normal' })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams({ width: 1 })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams({})).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams(null)).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams('normal')).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, from 0 to the bound the saved best has', () => {
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: 1234 })).toEqual({ score: 1234 });
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: 0 })).toEqual({ score: 0 });
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: 1_000_000_000 })).toEqual({
      score: 1_000_000_000,
    });
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: 1_000_000_001 })).toBeNull();
  });

  it('keeps only the score from the facts (the best and the width are not facts)', () => {
    expect(
      BOUNCE_UP_CHALLENGE.validateFacts({ score: 7, best: 90, previousBest: 80, width: 'wide' }),
    ).toEqual({ score: 7 });
  });

  it('refuses facts of the wrong shape', () => {
    expect(BOUNCE_UP_CHALLENGE.validateFacts(null)).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts([])).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({})).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: 1.5 })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: -1 })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: '12' })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: Number.NaN })).toBeNull();
    expect(BOUNCE_UP_CHALLENGE.validateFacts({ score: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
