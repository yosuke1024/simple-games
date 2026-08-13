import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelSpec } from './levels';

describe('bubble pop levels', () => {
  it('difficulty keeps climbing all the way to level 100 — nothing saturates early', () => {
    for (const [a, b] of [
      [1, 25],
      [25, 50],
      [50, 75],
      [75, LEVEL_COUNT],
    ] as const) {
      const low = levelSpec(a);
      const high = levelSpec(b);
      expect(high.rows).toBeGreaterThanOrEqual(low.rows);
      expect(high.colorCount).toBeGreaterThanOrEqual(low.colorCount);
      // Descent gets more frequent (a smaller number of shots) as the ladder climbs.
      expect(high.descentEvery).toBeLessThanOrEqual(low.descentEvery);
      expect(high.scatterBias).toBeGreaterThan(low.scatterBias);
    }
    expect(levelSpec(LEVEL_COUNT).rows).toBeGreaterThan(levelSpec(1).rows);
    expect(levelSpec(LEVEL_COUNT).colorCount).toBeGreaterThan(levelSpec(1).colorCount);
    expect(levelSpec(LEVEL_COUNT).descentEvery).toBeLessThan(levelSpec(1).descentEvery);
  });

  it('rows run 5 to 9 and color count runs 4 to 6, at the documented endpoints', () => {
    expect(levelSpec(1).rows).toBe(5);
    expect(levelSpec(LEVEL_COUNT).rows).toBe(9);
    expect(levelSpec(1).colorCount).toBe(4);
    expect(levelSpec(LEVEL_COUNT).colorCount).toBe(6);
  });

  it('descent frequency runs 8 shots down to 5 shots, at the documented endpoints', () => {
    expect(levelSpec(1).descentEvery).toBe(8);
    expect(levelSpec(LEVEL_COUNT).descentEvery).toBe(5);
  });

  it('every level in between stays within the documented ranges', () => {
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      const spec = levelSpec(level);
      expect(spec.rows).toBeGreaterThanOrEqual(5);
      expect(spec.rows).toBeLessThanOrEqual(9);
      expect(spec.colorCount).toBeGreaterThanOrEqual(4);
      expect(spec.colorCount).toBeLessThanOrEqual(6);
      expect(spec.descentEvery).toBeGreaterThanOrEqual(5);
      expect(spec.descentEvery).toBeLessThanOrEqual(8);
      expect(spec.scatterBias).toBeGreaterThanOrEqual(0);
      expect(spec.scatterBias).toBeLessThanOrEqual(1);
    }
  });

  it('level bounds are clamped rather than extrapolated', () => {
    expect(levelSpec(0)).toEqual(levelSpec(1));
    expect(levelSpec(-5)).toEqual(levelSpec(1));
    expect(levelSpec(999)).toEqual(levelSpec(LEVEL_COUNT));
  });
});
