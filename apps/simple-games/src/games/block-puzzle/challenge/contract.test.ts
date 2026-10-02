import { describe, expect, it } from 'vitest';
import { BLOCK_PUZZLE_CHALLENGE } from './contract';

describe('block-puzzle challenge contract', () => {
  it('is a score table (higher is better)', () => {
    expect(BLOCK_PUZZLE_CHALLENGE.contractVersion).toBe(1);
    expect(BLOCK_PUZZLE_CHALLENGE.order).toBe('score');
    expect(BLOCK_PUZZLE_CHALLENGE.direction).toBe('desc');
  });

  it('has no mode: one table, keyed standard', () => {
    expect(BLOCK_PUZZLE_CHALLENGE.validateParams({})).toEqual({});
    expect(BLOCK_PUZZLE_CHALLENGE.paramsKey({})).toBe('standard');
  });

  it('refuses params that are not an object', () => {
    expect(BLOCK_PUZZLE_CHALLENGE.validateParams(null)).toBeNull();
    expect(BLOCK_PUZZLE_CHALLENGE.validateParams('standard')).toBeNull();
    expect(BLOCK_PUZZLE_CHALLENGE.validateParams([])).toBeNull();
  });

  it('reads the score as an integer, with the other figures', () => {
    expect(BLOCK_PUZZLE_CHALLENGE.validateFacts({ score: 1234, lines: 4 })).toEqual({
      score: 1234,
      lines: 4,
    });
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: 0 }),
    ).toMatchObject({ score: 0 });
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: 1_000_000_000 }),
    ).toMatchObject({
      score: 1_000_000_000,
    });
  });

  it('refuses facts of the wrong shape', () => {
    expect(BLOCK_PUZZLE_CHALLENGE.validateFacts(null)).toBeNull();
    expect(BLOCK_PUZZLE_CHALLENGE.validateFacts([])).toBeNull();
    expect(BLOCK_PUZZLE_CHALLENGE.validateFacts({})).toBeNull();
    expect(BLOCK_PUZZLE_CHALLENGE.validateFacts({ score: 1 })).toBeNull();
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: 1.5 }),
    ).toBeNull();
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: -1 }),
    ).toBeNull();
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: 1_000_000_001 }),
    ).toBeNull();
    expect(
      BLOCK_PUZZLE_CHALLENGE.validateFacts({ ...{ score: 1234, lines: 4 }, score: '12' }),
    ).toBeNull();
  });
});
