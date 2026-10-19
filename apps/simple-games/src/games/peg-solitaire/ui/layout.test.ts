/**
 * Screen geometry (ui/layout.ts): where holes are drawn, which hole a point
 * falls in, and where the arrow keys move the focus
 * (docs/PEG_SOLITAIRE_RULES.md §4, §13). None of this is a rule — the tests
 * hold it to the rules' own geometry anyway, so the board on screen never
 * draws a line the rules do not have.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, holeIndex, TRIANGLE } from '../game';
import { holeAt, layoutOf, stepFocus, type ArrowKey } from './layout';

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

describe('board layout (§13)', () => {
  it('draws the cross on its 7×7 grid', () => {
    const layout = layoutOf(ENGLISH);
    expect([layout.width, layout.height]).toEqual([7, 7]);
    expect(layout.centers).toHaveLength(33);
    expect(layout.centers[16]).toEqual({ x: 3.5, y: 3.5 });
  });

  it('draws every jump of either board as three evenly spaced holes in a straight line', () => {
    for (const geometry of [ENGLISH, TRIANGLE]) {
      const centers = layoutOf(geometry).centers;
      for (const jump of geometry.jumps) {
        const [from, over, to] = [centers[jump.from]!, centers[jump.over]!, centers[jump.to]!];
        // Neighbours are one pitch apart, and `over` is the midpoint.
        expect(distance(from, over)).toBeCloseTo(1, 9);
        expect(distance(over, to)).toBeCloseTo(1, 9);
        expect((from.x + to.x) / 2).toBeCloseTo(over.x, 9);
        expect((from.y + to.y) / 2).toBeCloseTo(over.y, 9);
      }
    }
  });

  it('never puts two holes closer than a pitch, so their tap discs never overlap', () => {
    for (const geometry of [ENGLISH, TRIANGLE]) {
      const centers = layoutOf(geometry).centers;
      for (let a = 0; a < centers.length; a++) {
        for (let b = a + 1; b < centers.length; b++) {
          expect(distance(centers[a]!, centers[b]!)).toBeGreaterThan(0.999);
        }
      }
    }
  });

  it('keeps the triangle inside its box, apex up', () => {
    const layout = layoutOf(TRIANGLE);
    expect(layout.width).toBe(5);
    expect(layout.height).toBeCloseTo(1 + 4 * (Math.sqrt(3) / 2), 9);
    expect(layout.centers[0]).toEqual({ x: 2.5, y: 0.5 });
    for (const center of layout.centers) {
      expect(center.x - 0.5).toBeGreaterThanOrEqual(-1e-9);
      expect(center.x + 0.5).toBeLessThanOrEqual(layout.width + 1e-9);
      expect(center.y + 0.5).toBeLessThanOrEqual(layout.height + 1e-9);
    }
  });

  it('finds the hole under a point, and nothing between holes or off the board', () => {
    const cross = layoutOf(ENGLISH);
    expect(holeAt(cross, 3.5, 3.5)).toBe(16);
    expect(holeAt(cross, 3.9, 3.2)).toBe(16);
    // A cut corner, and the gap between two neighbours.
    expect(holeAt(cross, 0.5, 0.5)).toBe(-1);
    expect(holeAt(cross, 4, 4)).toBe(-1);
    const triangle = layoutOf(TRIANGLE);
    triangle.centers.forEach((center, index) => {
      expect(holeAt(triangle, center.x, center.y)).toBe(index);
    });
    expect(holeAt(triangle, 0.2, 0.2)).toBe(-1);
  });
});

describe('arrow keys (§4)', () => {
  const walk = (geometry: typeof ENGLISH, from: number, keys: ArrowKey[]) =>
    keys.reduce((at, key) => stepFocus(geometry, at, key), from);

  it('move one hole at a time on the cross, and stop at its edges and cut corners', () => {
    const center = holeIndex(ENGLISH, 3, 3);
    expect(stepFocus(ENGLISH, center, 'ArrowUp')).toBe(holeIndex(ENGLISH, 2, 3));
    expect(stepFocus(ENGLISH, center, 'ArrowRight')).toBe(holeIndex(ENGLISH, 3, 4));
    expect(walk(ENGLISH, center, ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp'])).toBe(
      holeIndex(ENGLISH, 0, 3),
    );
    // (2, 0) has a cut corner above it: the focus stays.
    const armEnd = holeIndex(ENGLISH, 2, 0);
    expect(stepFocus(ENGLISH, armEnd, 'ArrowUp')).toBe(armEnd);
    expect(stepFocus(ENGLISH, armEnd, 'ArrowLeft')).toBe(armEnd);
  });

  it('move along a row and between rows on the triangle, ↑ undoing ↓', () => {
    expect(stepFocus(TRIANGLE, 0, 'ArrowUp')).toBe(0);
    expect(stepFocus(TRIANGLE, 0, 'ArrowLeft')).toBe(0);
    expect(stepFocus(TRIANGLE, 0, 'ArrowDown')).toBe(holeIndex(TRIANGLE, 1, 0));
    expect(stepFocus(TRIANGLE, holeIndex(TRIANGLE, 4, 0), 'ArrowRight')).toBe(
      holeIndex(TRIANGLE, 4, 1),
    );
    for (let index = 0; index < 10; index++) {
      // Every hole above the bottom row comes back to itself by ↓ then ↑.
      expect(walk(TRIANGLE, index, ['ArrowDown', 'ArrowUp'])).toBe(index);
    }
    // The last hole of a row has no hole straight above in its own place.
    expect(stepFocus(TRIANGLE, holeIndex(TRIANGLE, 2, 2), 'ArrowUp')).toBe(
      holeIndex(TRIANGLE, 1, 1),
    );
    expect(stepFocus(TRIANGLE, holeIndex(TRIANGLE, 4, 2), 'ArrowDown')).toBe(
      holeIndex(TRIANGLE, 4, 2),
    );
  });

  it('can reach every hole of either board', () => {
    for (const geometry of [ENGLISH, TRIANGLE]) {
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length > 0) {
        const at = queue.shift()!;
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const) {
          const next = stepFocus(geometry, at, key);
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.size).toBe(geometry.holes.length);
    }
  });
});
