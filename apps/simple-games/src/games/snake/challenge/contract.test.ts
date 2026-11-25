import { describe, expect, it } from 'vitest';
import { MAX_SCORE, SPEEDS } from '../game/types';
import { SNAKE_CHALLENGE } from './contract';

describe('snake challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(SNAKE_CHALLENGE.contractVersion).toBe(1);
    expect(SNAKE_CHALLENGE.order).toBe('score');
    expect(SNAKE_CHALLENGE.direction).toBe('desc');
  });

  it('accepts each speed the game has and keys the table by it', () => {
    expect(SPEEDS).toEqual(['slow', 'normal', 'fast']);
    for (const speed of SPEEDS) {
      expect(SNAKE_CHALLENGE.validateParams({ speed })).toEqual({ speed });
      expect(SNAKE_CHALLENGE.paramsKey({ speed })).toBe(speed);
    }
  });

  it('keeps only the speed from the params', () => {
    expect(SNAKE_CHALLENGE.validateParams({ speed: 'fast', extra: 1 })).toEqual({ speed: 'fast' });
  });

  it('refuses params that do not fit', () => {
    expect(SNAKE_CHALLENGE.validateParams({ speed: 'turbo' })).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams({ speed: 'Normal' })).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams({ speed: 150 })).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams({})).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams(null)).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams('normal')).toBeNull();
    expect(SNAKE_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, from 0 to the full board', () => {
    expect(SNAKE_CHALLENGE.validateFacts({ score: 42 })).toEqual({ score: 42 });
    expect(SNAKE_CHALLENGE.validateFacts({ score: 0 })).toEqual({ score: 0 });
    expect(SNAKE_CHALLENGE.validateFacts({ score: MAX_SCORE })).toEqual({ score: MAX_SCORE });
  });

  it('bounds the score at the game’s own full board (a literal, since the contract imports nothing)', () => {
    expect(MAX_SCORE).toBe(193);
    expect(SNAKE_CHALLENGE.validateFacts({ score: MAX_SCORE + 1 })).toBeNull();
  });

  it('keeps only the score from the facts (the length is not sent)', () => {
    expect(SNAKE_CHALLENGE.validateFacts({ score: 7, length: 10 })).toEqual({ score: 7 });
  });

  it('refuses facts of the wrong shape', () => {
    expect(SNAKE_CHALLENGE.validateFacts(null)).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts([])).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({})).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({ score: 1.5 })).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({ score: -1 })).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({ score: '12' })).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({ score: Number.NaN })).toBeNull();
    expect(SNAKE_CHALLENGE.validateFacts({ score: Number.POSITIVE_INFINITY })).toBeNull();
  });
});
