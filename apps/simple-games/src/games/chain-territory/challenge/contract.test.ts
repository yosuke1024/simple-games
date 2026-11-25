import { describe, expect, it } from 'vitest';
import { MODES } from '../game';
import { CHAIN_TERRITORY_CHALLENGE } from './contract';

describe('chain-territory challenge contract', () => {
  it('is a moves table (fewer is better)', () => {
    expect(CHAIN_TERRITORY_CHALLENGE.contractVersion).toBe(1);
    expect(CHAIN_TERRITORY_CHALLENGE.order).toBe('moves');
    expect(CHAIN_TERRITORY_CHALLENGE.direction).toBe('asc');
  });

  it('accepts each CPU strength and keys the table by it', () => {
    for (const value of ['easy', 'normal', 'hard']) {
      expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ difficulty: value })).toEqual({
        difficulty: value,
      });
      expect(CHAIN_TERRITORY_CHALLENGE.paramsKey({ difficulty: value })).toBe(value);
    }
  });

  it('names the same strengths the game plays', () => {
    // The contract copies the list so it stays a leaf; a new strength must reach both.
    for (const mode of MODES) {
      expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ difficulty: mode })).not.toBeNull();
    }
    expect(MODES).toEqual(['easy', 'normal', 'hard']);
  });

  it('keeps only the difficulty from params', () => {
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ difficulty: 'hard', seed: 7 })).toEqual({
      difficulty: 'hard',
    });
  });

  it('refuses params that do not fit', () => {
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ difficulty: 'medium' })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ difficulty: 'Hard' })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams({ mode: 'easy' })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams({})).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams(null)).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams([])).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams('easy')).toBeNull();
  });

  it('reads the moves as a bounded non-negative integer, and nothing else', () => {
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 12 })).toEqual({ moves: 12 });
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 0 })).toEqual({ moves: 0 });
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 100_000 })).toEqual({
      moves: 100_000,
    });
    // A figure the result screen does not show is not carried along.
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 12, elapsedSeconds: 40 })).toEqual({
      moves: 12,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts(null)).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts([])).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({})).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 1.5 })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: -1 })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: 100_001 })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: '12' })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: Number.NaN })).toBeNull();
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts({ moves: Infinity })).toBeNull();
  });
});
