import { describe, expect, it } from 'vitest';
import { DAILY_DIFFICULTY } from '../game/daily';
import { createDailySession } from '../game/session';
import { DIFFICULTIES } from '../game/types';
import { UNBLOCK_PUZZLE_CHALLENGE as contract } from './contract';

describe('unblock-puzzle challenge contract', () => {
  it('ranks by elapsed time, lower first', () => {
    expect(contract.contractVersion).toBe(1);
    expect(contract.order).toBe('elapsedSeconds');
    expect(contract.direction).toBe('asc');
  });

  it('accepts the params a player can choose and drops anything else', () => {
    expect(contract.validateParams({ difficulty: 'hard' })).toEqual({ difficulty: 'hard' });
    expect(contract.validateParams({ ...{ difficulty: 'hard' }, extra: 1 })).toEqual({
      difficulty: 'hard',
    });
  });

  it('accepts every difficulty the game deals, the daily’s included', () => {
    // A daily whose params the contract refused would be dropped silently by
    // the bridge (docs/UNBLOCK_PUZZLE_RULES.md §18).
    for (const difficulty of [...DIFFICULTIES, DAILY_DIFFICULTY]) {
      expect(contract.validateParams({ difficulty })).toEqual({ difficulty });
    }
    // The params the result card passes for a daily, exactly.
    const daily = createDailySession('2026-11-15');
    expect(contract.validateParams({ difficulty: daily.difficulty })).toEqual({
      difficulty: 'medium',
    });
  });

  it('refuses params of the wrong shape', () => {
    expect(contract.validateParams(null)).toBeNull();
    expect(contract.validateParams('x')).toBeNull();
    expect(contract.validateParams([])).toBeNull();
    expect(contract.validateParams({})).toBeNull();
    expect(contract.validateParams({ difficulty: 'daily' })).toBeNull();
    expect(contract.validateParams({ difficulty: 'Hard' })).toBeNull();
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

  it('reads the figures the result card shows', () => {
    expect(contract.validateFacts({ elapsedSeconds: 125, moves: 14, hints: 2 })).toEqual({
      elapsedSeconds: 125,
      moves: 14,
      hints: 2,
    });
    expect(
      contract.validateFacts({ elapsedSeconds: 125, moves: 14, hints: 2, minMoves: 12 }),
    ).toEqual({
      elapsedSeconds: 125,
      moves: 14,
      hints: 2,
    });
  });

  it('needs the time axis, as a whole number of seconds in a day', () => {
    const rest = { moves: 14, hints: 2 };
    expect(contract.validateFacts(rest)).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 12.5 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: -1 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: '12' })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: Number.NaN })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 86_401 })).toBeNull();
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 86_400 })).toMatchObject({
      elapsedSeconds: 86_400,
    });
    expect(contract.validateFacts({ ...rest, elapsedSeconds: 0 })).toMatchObject({
      elapsedSeconds: 0,
    });
  });

  it('needs the moves and the hints, as whole counts', () => {
    const time = { elapsedSeconds: 125 };
    expect(contract.validateFacts({ ...time, hints: 2 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 14 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: -1, hints: 2 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 1.5, hints: 2 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: '14', hints: 2 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 100_001, hints: 2 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 14, hints: -1 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 14, hints: 100_001 })).toBeNull();
    expect(contract.validateFacts({ ...time, moves: 100_000, hints: 100_000 })).toEqual({
      elapsedSeconds: 125,
      moves: 100_000,
      hints: 100_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(contract.validateFacts(null)).toBeNull();
    expect(contract.validateFacts('x')).toBeNull();
    expect(contract.validateFacts([])).toBeNull();
    expect(contract.validateFacts({})).toBeNull();
  });
});
