import { describe, expect, it } from 'vitest';
import { SIZES } from '../game';
import { COLOR_FLOOD_CHALLENGE } from './contract';

describe('color-flood challenge contract', () => {
  it('ranks moves upward (fewer is better)', () => {
    expect(COLOR_FLOOD_CHALLENGE.contractVersion).toBe(1);
    expect(COLOR_FLOOD_CHALLENGE.order).toBe('moves');
    expect(COLOR_FLOOD_CHALLENGE.direction).toBe('asc');
  });

  it('accepts every board size the game offers, and nothing else', () => {
    for (const size of SIZES) {
      expect(COLOR_FLOOD_CHALLENGE.validateParams({ size })).toEqual({ size });
    }
    for (const raw of [
      { size: 3 },
      { size: 8 },
      { size: 16 },
      { size: '10' },
      { size: 10.5 },
      {},
      null,
      [],
      10,
    ]) {
      expect(COLOR_FLOOD_CHALLENGE.validateParams(raw)).toBeNull();
    }
  });

  it('keeps only the known params', () => {
    expect(COLOR_FLOOD_CHALLENGE.validateParams({ size: 10, seed: 7, extra: 1 })).toEqual({
      size: 10,
    });
  });

  it("accepts the clear card's moves and nothing more", () => {
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({ moves: 21 })).toEqual({ moves: 21 });
    // Time and the personal best are not in the card's details, so they are not kept.
    expect(
      COLOR_FLOOD_CHALLENGE.validateFacts({ moves: 21, elapsedSeconds: 90, best: 18 }),
    ).toEqual({ moves: 21 });
  });

  it('reads moves as an integer in range', () => {
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({ moves: 0 })).toEqual({ moves: 0 });
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({ moves: 195 })).toEqual({ moves: 195 });
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({ moves: 100_000 })).toEqual({ moves: 100_000 });
    for (const moves of [100_001, -1, 1.5, '21', Number.NaN, Number.POSITIVE_INFINITY, null]) {
      expect(COLOR_FLOOD_CHALLENGE.validateFacts({ moves })).toBeNull();
    }
  });

  it('rejects facts without the axis or of the wrong shape', () => {
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({})).toBeNull();
    expect(COLOR_FLOOD_CHALLENGE.validateFacts({ elapsedSeconds: 90 })).toBeNull();
    expect(COLOR_FLOOD_CHALLENGE.validateFacts(null)).toBeNull();
    expect(COLOR_FLOOD_CHALLENGE.validateFacts([])).toBeNull();
    expect(COLOR_FLOOD_CHALLENGE.validateFacts('21')).toBeNull();
  });

  it('names the table by paramsKey', () => {
    const keys = SIZES.map((size) => COLOR_FLOOD_CHALLENGE.paramsKey({ size }));
    expect(keys).toEqual(['6x6', '10x10', '14x14']);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9-]{1,40}$/);
  });
});
