import { describe, expect, it } from 'vitest';
import { COLS } from './constants';
import {
  RECTANGLE,
  RECTANGLE_ONLY_UP_TO_LEVEL,
  rowLayout,
  SHAPE_FAMILIES,
  shapeForDaily,
  shapeForLevel,
  shapeForSession,
  widthAt,
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

describe('widthAt', () => {
  it('cycles through the shape', () => {
    const shape = [5, 9, 3];
    expect([0, 1, 2, 3, 4, 5].map((i) => widthAt(shape, i))).toEqual([5, 9, 3, 5, 9, 3]);
  });

  it('clamps to a usable width', () => {
    expect(widthAt([99], 0)).toBe(COLS);
    expect(widthAt([0], 0)).toBe(1);
  });
});

describe('shape selection', () => {
  it('keeps the first levels rectangular so the rules land first', () => {
    for (let level = 1; level <= RECTANGLE_ONLY_UP_TO_LEVEL; level++) {
      expect(shapeForLevel(level)).toEqual(RECTANGLE);
    }
  });

  it('is deterministic per level and per date', () => {
    for (const level of [4, 17, 250, 999]) {
      expect(shapeForLevel(level)).toEqual(shapeForLevel(level));
    }
    expect(shapeForDaily('2026-07-28')).toEqual(shapeForDaily('2026-07-28'));
  });

  it('only ever returns a known family', () => {
    for (let level = 1; level <= 200; level++) {
      expect(SHAPE_FAMILIES).toContainEqual(shapeForLevel(level));
    }
  });

  it('actually varies the outline across levels', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 200; level++) seen.add(shapeForLevel(level).join('-'));
    expect(seen.size).toBeGreaterThan(1);
  });

  it('routes a session to its level or its date', () => {
    expect(shapeForSession(42, null)).toEqual(shapeForLevel(42));
    expect(shapeForSession(null, '2026-07-28')).toEqual(shapeForDaily('2026-07-28'));
  });
});
