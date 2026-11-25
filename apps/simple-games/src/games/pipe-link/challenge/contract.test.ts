import { describe, expect, it } from 'vitest';
import { PIPE_LINK_CHALLENGE as contract } from './contract';

describe('pipe-link challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
    expect(contract).not.toHaveProperty('levelRange');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ difficulty: 'easy' })).toEqual({ difficulty: 'easy' });
    expect(contract.validateParams({ difficulty: 'hard' })).toEqual({ difficulty: 'hard' });
    expect(contract.validateParams({ ...{ difficulty: 'hard' }, extra: 1 })).toEqual({
      difficulty: 'hard',
    });
  });

  it("accepts the daily's params as they are (the daily is Medium every day)", () => {
    // The result screen sends the session's own difficulty; a daily whose
    // params the contract refused would be dropped by the bridge silently.
    expect(contract.validateParams({ difficulty: 'medium' })).toEqual({ difficulty: 'medium' });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ difficulty: 'daily' })).toBeNull();
    expect(contract.validateParams({ difficulty: 'Medium' })).toBeNull();
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
      expect(key).toBe(value);
      expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
    }
  });

  it('reads the figures the result screen shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 2 })).toEqual({
      elapsedSeconds: 125,
      hints: 2,
    });
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 0 })).toEqual({
      elapsedSeconds: 125,
      hints: 0,
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
    expect(contract.validateFacts({ ...rest, elapsedSeconds: Number.NaN })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 86_400 })).toMatchObject({
      elapsedSeconds: 86_400,
    });
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 0 })).toMatchObject({
      elapsedSeconds: 0,
    });
  });

  it('refuses a clear after more than a day of visible play, though the game counts on', () => {
    // The game's own counters stop at 1e9 (game/session.ts MAX_COUNTER); the
    // Club's ceiling is a day of seconds, as Box Regions'. Such a result is
    // simply not listed.
    expect(contract.validateFacts({ elapsedSeconds: 86_401, hints: 0 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 1e9, hints: 0 })).toBeNull();
  });

  it('refuses facts of the wrong shape', () => {
    expect(contract.validateFacts(null)).toBeNull();
    expect(contract.validateFacts('x')).toBeNull();
    expect(contract.validateFacts([])).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: -1 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 1.5 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: '2' })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 100_001 })).toBeNull();
    expect(contract.validateFacts({ elapsedSeconds: 125, hints: 100_000 })).toEqual({
      elapsedSeconds: 125,
      hints: 100_000,
    });
  });
});
