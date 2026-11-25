import { describe, expect, it } from 'vitest';
import { SIZES } from '../game';
import { LIGHT_GRID_CHALLENGE } from './contract';

describe('light-grid challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(LIGHT_GRID_CHALLENGE.contractVersion).toBe(1);
    expect(LIGHT_GRID_CHALLENGE.order).toBe('moves');
    expect(LIGHT_GRID_CHALLENGE.direction).toBe('asc');
  });

  it('accepts every board size the game offers, and nothing else', () => {
    for (const size of SIZES) {
      expect(LIGHT_GRID_CHALLENGE.validateParams({ size })).toEqual({ size });
    }
    for (const raw of [{ size: 2 }, { size: 6 }, { size: '4' }, { size: 4.5 }, {}, null, [], 4]) {
      expect(LIGHT_GRID_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(LIGHT_GRID_CHALLENGE.validateParams({ size: 4, seed: 7, extra: 1 })).toEqual({
      size: 4,
    });
  });

  it("accepts the clear card's moves and nothing more", () => {
    expect(LIGHT_GRID_CHALLENGE.validateFacts({ moves: 7 })).toEqual({ moves: 7 });
    // Time, hints and the personal best are not on the card's details, so they are not kept.
    expect(
      LIGHT_GRID_CHALLENGE.validateFacts({ moves: 7, elapsedSeconds: 30, hints: 2, best: 5 }),
    ).toEqual({ moves: 7 });
  });

  it('reads moves as an integer in range', () => {
    expect(LIGHT_GRID_CHALLENGE.validateFacts({ moves: 0 })).toEqual({ moves: 0 });
    expect(LIGHT_GRID_CHALLENGE.validateFacts({ moves: 100_000 })).toEqual({ moves: 100_000 });
    for (const moves of [100_001, -1, 1.5, '7', Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(LIGHT_GRID_CHALLENGE.validateFacts({ moves })).toBeNull();
    }
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(LIGHT_GRID_CHALLENGE.validateFacts({})).toBeNull();
    expect(LIGHT_GRID_CHALLENGE.validateFacts({ elapsedSeconds: 30 })).toBeNull();
    expect(LIGHT_GRID_CHALLENGE.validateFacts(null)).toBeNull();
    expect(LIGHT_GRID_CHALLENGE.validateFacts([])).toBeNull();
    expect(LIGHT_GRID_CHALLENGE.validateFacts('7')).toBeNull();
  });

  it('names the table by paramsKey', () => {
    const keys = SIZES.map((size) => LIGHT_GRID_CHALLENGE.paramsKey({ size }));
    expect(keys).toEqual(['3x3', '4x4', '5x5']);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
