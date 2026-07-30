import { describe, expect, it } from 'vitest';
import { COLS } from './constants';
import {
  RECTANGLE,
  RECTANGLE_ONLY_UP_TO_LEVEL,
  rowLayout,
  SHAPES,
  shapeForDaily,
  shapeForLevel,
  shapeForSession,
  startingWidths,
} from './shapes';

describe('rowLayout', () => {
  it('centers the playable run within the row', () => {
    expect(rowLayout(9).filter(Boolean)).toHaveLength(9);
    expect(rowLayout(5)).toEqual([false, false, true, true, true, true, true, false, false]);
    expect(rowLayout(3)).toEqual([false, false, false, true, true, true, false, false, false]);
  });

  it('always spans exactly COLS slots and clamps silly widths', () => {
    for (const width of [-4, 0, 1, 9, 40]) {
      const layout = rowLayout(width);
      expect(layout).toHaveLength(COLS);
      expect(layout.filter(Boolean).length).toBeGreaterThanOrEqual(1);
      expect(layout.filter(Boolean).length).toBeLessThanOrEqual(COLS);
    }
  });
});

describe('startingWidths', () => {
  const targets = [15, 25, 27, 30, 36, 45, 54, 63];

  it('only ever uses odd widths, so every row can sit centred', () => {
    for (const shape of SHAPES) {
      for (const target of targets) {
        for (const width of startingWidths(shape, target)) {
          expect(width % 2).toBe(1);
          expect(width).toBeGreaterThanOrEqual(1);
          expect(width).toBeLessThanOrEqual(COLS);
        }
      }
    }
  });

  it('draws a whole motif rather than a slice of a repeating cycle', () => {
    // A symmetric shape must read the same upside down at any size.
    for (const key of ['diamond', 'hourglass']) {
      const shape = SHAPES.find((s) => s.key === key)!;
      for (const target of targets) {
        const widths = startingWidths(shape, target);
        expect(widths).toEqual([...widths].reverse());
      }
    }
  });

  it('runs monotonically for the one-way shapes', () => {
    for (const [key, compare] of [
      ['pyramid', (a: number, b: number) => a <= b],
      ['funnel', (a: number, b: number) => a >= b],
    ] as const) {
      const shape = SHAPES.find((s) => s.key === key)!;
      const widths = startingWidths(shape, 45);
      for (let i = 1; i < widths.length; i++) {
        expect(compare(widths[i - 1]!, widths[i]!)).toBe(true);
      }
    }
  });

  it('lands near the requested number of cells', () => {
    for (const shape of SHAPES) {
      for (const target of targets) {
        const total = startingWidths(shape, target).reduce((sum, w) => sum + w, 0);
        // Whole rows only, so the total lands within a row of the target.
        expect(Math.abs(total - target)).toBeLessThanOrEqual(COLS);
      }
    }
  });

  it('falls back to a rectangle when there are too few rows to read a shape', () => {
    const diamond = SHAPES.find((s) => s.key === 'diamond')!;
    expect(startingWidths(diamond, 9)).toEqual(startingWidths(RECTANGLE, 9));
  });
});

describe('shape selection', () => {
  it('keeps the first levels rectangular so the rules land first', () => {
    for (let level = 1; level <= RECTANGLE_ONLY_UP_TO_LEVEL; level++) {
      expect(shapeForLevel(level)).toBe(RECTANGLE);
    }
  });

  it('is deterministic per level and per date', () => {
    for (const level of [4, 17, 250, 999]) {
      expect(shapeForLevel(level)).toBe(shapeForLevel(level));
    }
    expect(shapeForDaily('2026-07-28')).toBe(shapeForDaily('2026-07-28'));
  });

  it('only ever returns a known shape, and varies them across levels', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 200; level++) {
      const shape = shapeForLevel(level);
      expect(SHAPES).toContain(shape);
      seen.add(shape.key);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('routes a session to its level or its date', () => {
    expect(shapeForSession(42, null)).toBe(shapeForLevel(42));
    expect(shapeForSession(null, '2026-07-28')).toBe(shapeForDaily('2026-07-28'));
  });
});
