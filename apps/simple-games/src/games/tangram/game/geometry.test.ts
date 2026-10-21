/**
 * Exact overlap and containment (docs/TANGRAM_RULES.md §5「判定」, §13).
 * Shapes here are arbitrary convex polygons with 8-direction edges; the
 * predicates do not care whether they are tangram pieces.
 */
import { describe, expect, it } from 'vitest';
import {
  convexInside,
  convexOverlap,
  directionOf,
  doubledArea,
  edgeLength,
  edgeTicks,
  isReflexVertex,
  isSimplePolygon,
  isTickOf,
  pointInPolygon,
  segmentCrossesInterior,
  strictlyOverlap,
  type Interval,
} from './geometry';
import { ip } from './test-helpers';
import { lt, max, min, ptKey, type Pt, type Z2 } from './z2';

const iv = (a: number, b: number): Interval => [
  [a, 0],
  [b, 0],
];
/** The max < min form the rules reject (§5「区間の厳密な重なり」). */
const maxBelowMin = (a: Interval, b: Interval): boolean => lt(max(a[0], b[0]), min(a[1], b[1]));
const poly = (...xy: number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push(ip(xy[i]!, xy[i + 1]!));
  return out;
};
const square4 = poly(0, 0, 4, 0, 4, 4, 0, 4);
const diamond = poly(2, 0, 4, 2, 2, 4, 0, 2);

describe('strict interval overlap (§5)', () => {
  it('judges two wide intervals', () => {
    expect(strictlyOverlap(iv(0, 2), iv(3, 5))).toBe(false); // apart
    expect(strictlyOverlap(iv(0, 2), iv(2, 5))).toBe(false); // ends meet
    expect(strictlyOverlap(iv(0, 3), iv(2, 5))).toBe(true); // overlap
    expect(strictlyOverlap(iv(0, 6), iv(2, 5))).toBe(true); // contains
  });

  it('judges a one-point interval: inside, at an end, outside', () => {
    expect(strictlyOverlap(iv(3, 3), iv(2, 5))).toBe(true);
    expect(strictlyOverlap(iv(2, 2), iv(2, 5))).toBe(false);
    expect(strictlyOverlap(iv(5, 5), iv(2, 5))).toBe(false);
    expect(strictlyOverlap(iv(7, 7), iv(2, 5))).toBe(false);
    // The rejected form is false even for the inside point — that is the bug it would hide.
    expect(maxBelowMin(iv(3, 3), iv(2, 5))).toBe(false);
    expect(maxBelowMin(iv(0, 3), iv(2, 5))).toBe(true);
  });

  it('compares irrational ends exactly', () => {
    const a: Interval = [
      [0, 0],
      [0, 1],
    ]; // [0, √2]
    const b: Interval = [
      [0, 1],
      [3, 0],
    ]; // [√2, 3]
    expect(strictlyOverlap(a, b)).toBe(false);
    const c: Interval = [
      [1, 0],
      [3, 0],
    ]; // [1, 3]
    expect(strictlyOverlap(a, c)).toBe(true);
  });
});

describe('overlap of two convex shapes (§5「重なり」)', () => {
  const at = (dx: number, dy: number, shape: Pt[]): Pt[] =>
    shape.map((v) => [v[0] + dx, v[1], v[2] + dy, v[3]] as Pt);
  it('is false when apart, touching along an edge, at a vertex, or along a line', () => {
    expect(convexOverlap(square4, at(6, 0, square4))).toBe(false);
    expect(convexOverlap(square4, at(4, 0, square4))).toBe(false); // shared edge
    expect(convexOverlap(square4, at(4, 4, square4))).toBe(false); // shared vertex
    expect(convexOverlap(square4, at(4, 2, square4))).toBe(false); // edges on one line, offset
    expect(convexOverlap(diamond, at(2, 2, diamond))).toBe(false); // diagonal edges touching
  });

  it('is true when they overlap in part or one contains the other', () => {
    expect(convexOverlap(square4, at(3, 1, square4))).toBe(true);
    expect(convexOverlap(square4, poly(1, 1, 3, 1, 3, 3, 1, 3))).toBe(true);
    expect(convexOverlap(diamond, at(1, 1, diamond))).toBe(true);
    expect(convexOverlap(diamond, square4)).toBe(true);
  });

  it('separates a triangle from a square across a diagonal it only touches', () => {
    const tri = poly(4, 0, 4, 4, 0, 4); // the lower-right half of square4
    const upper = poly(0, 0, 4, 0, 0, 4);
    expect(convexOverlap(tri, upper)).toBe(false);
    expect(convexOverlap(tri, square4)).toBe(true);
  });
});

describe('a segment through a convex shape (§5「内包」1, one axis per edge direction)', () => {
  it('horizontal edge (one point on the y axis)', () => {
    expect(segmentCrossesInterior(ip(-2, 2), ip(6, 2), square4)).toBe(true);
    expect(segmentCrossesInterior(ip(-2, 0), ip(6, 0), square4)).toBe(false); // along the side
    expect(segmentCrossesInterior(ip(-2, 2), ip(0, 2), square4)).toBe(false); // end touches
  });
  it('vertical edge (one point on the x axis)', () => {
    expect(segmentCrossesInterior(ip(2, -2), ip(2, 6), square4)).toBe(true);
    expect(segmentCrossesInterior(ip(4, -2), ip(4, 6), square4)).toBe(false);
    expect(segmentCrossesInterior(ip(2, -2), ip(2, 0), square4)).toBe(false);
  });
  it('edge along x + y = c (one point on the x + y axis)', () => {
    expect(segmentCrossesInterior(ip(0, 4), ip(4, 0), diamond)).toBe(true);
    expect(segmentCrossesInterior(ip(5, 1), ip(1, 5), diamond)).toBe(false); // along a side
    expect(segmentCrossesInterior(ip(4, 2), ip(6, 0), diamond)).toBe(false); // from a vertex outwards
  });
  it('edge along x − y = c (one point on the x − y axis)', () => {
    expect(segmentCrossesInterior(ip(-1, -1), ip(5, 5), diamond)).toBe(true);
    expect(segmentCrossesInterior(ip(1, -1), ip(5, 3), diamond)).toBe(false); // along a side
    expect(segmentCrossesInterior(ip(2, 4), ip(3, 5), diamond)).toBe(false); // from a vertex outwards
  });
});

describe('the point test (§5「内包」2)', () => {
  const lShape = poly(0, 0, 6, 0, 6, 2, 2, 2, 2, 6, 0, 6);
  it('counts crossings with exact sides', () => {
    expect(pointInPolygon(ip(1, 1), lShape)).toBe(true);
    expect(pointInPolygon(ip(5, 1), lShape)).toBe(true);
    expect(pointInPolygon(ip(1, 5), lShape)).toBe(true);
    expect(pointInPolygon(ip(4, 4), lShape)).toBe(false);
    expect(pointInPolygon(ip(7, 1), lShape)).toBe(false);
    expect(pointInPolygon(ip(-1, 1), lShape)).toBe(false);
    // A ray through a vertex is counted once (half-open in y), inside and out.
    expect(pointInPolygon(ip(1, 2), poly(0, 0, 2, 2, 0, 4))).toBe(true);
    expect(pointInPolygon(ip(-1, 2), poly(0, 0, 2, 2, 0, 4))).toBe(false);
    expect(pointInPolygon(ip(-1, 2), poly(0, 0, 2, 2, 4, 0, 4, 4, 0, 4))).toBe(false);
    expect(pointInPolygon([0, 1, 1, 0], poly(0, 0, 4, 0, 4, 4, 0, 4))).toBe(true); // x = √2
  });
});

describe('containment (§5「内包」)', () => {
  const big = poly(0, 0, 16, 0, 16, 16, 0, 16);
  it('accepts a shape inside, and one along the edge', () => {
    expect(convexInside(poly(2, 2, 6, 2, 6, 6, 2, 6), big)).toBe(true);
    expect(convexInside(poly(0, 0, 4, 0, 4, 4, 0, 4), big)).toBe(true);
    expect(convexInside(big, big)).toBe(true);
  });

  it('refuses a shape with a vertex outside', () => {
    expect(convexInside(poly(14, 2, 18, 2, 18, 6, 14, 6), big)).toBe(false);
  });

  it('refuses a shape wholly outside (condition 1 alone cannot tell)', () => {
    const outside = poly(20, 2, 24, 2, 24, 6, 20, 6);
    expect(convexInside(outside, big)).toBe(false);
    expect(big.some((v, i) => segmentCrossesInterior(v, big[(i + 1) % 4]!, outside))).toBe(false);
  });

  it('refuses a shape that a corner of the silhouette pokes into (condition 2 alone cannot tell)', () => {
    // A V-shaped notch from the top edge, its tip at (8, 4), inside the square below.
    const notched = poly(0, 0, 4, 0, 8, 4, 12, 0, 16, 0, 16, 16, 0, 16);
    const around = poly(5, 3, 11, 3, 11, 9, 5, 9);
    expect(around.every((v) => pointInPolygon(v, notched))).toBe(true);
    expect(convexInside(around, notched)).toBe(false);
  });

  it('refuses a shape whose vertices all lie on the silhouette but which covers its notch', () => {
    // A square notch from the top; a triangle from corner to corner spans it.
    const notched = poly(0, 0, 2, 0, 2, 2, 4, 2, 4, 0, 6, 0, 6, 6, 0, 6);
    const triangle = poly(0, 0, 4, 0, 0, 4);
    expect(convexInside(triangle, notched)).toBe(false);
    // The interior point the containment test uses is inside the silhouette, so
    // without condition 1 this would pass.
    expect(
      pointInPolygon(
        ip(4, 4),
        notched.map((v) => v.map((c) => 4 * c) as unknown as Pt),
      ),
    ).toBe(true);
  });
});

describe('outline helpers (§2)', () => {
  it('measures twice the signed area, positive clockwise on screen', () => {
    expect(doubledArea(square4)).toEqual([32, 0]);
    expect(doubledArea([...square4].reverse())).toEqual([-32, 0]);
  });

  it('tells simple polygons from self-touching ones', () => {
    expect(isSimplePolygon(square4)).toBe(true);
    expect(isSimplePolygon(poly(0, 0, 4, 0, 0, 4, 4, 4))).toBe(false); // a bow tie
    // Two squares meeting at one corner, written as one loop: a pinch.
    expect(isSimplePolygon(poly(0, 0, 2, 0, 2, 2, 4, 2, 4, 4, 2, 4, 2, 2, 0, 2))).toBe(false);
    // An edge folding back on the one before it.
    expect(isSimplePolygon(poly(0, 0, 4, 0, 2, 0, 2, 2))).toBe(false);
    // A non-adjacent vertex touching an edge.
    expect(isSimplePolygon(poly(0, 0, 4, 0, 4, 4, 2, 0, 0, 4))).toBe(false);
  });

  it('finds reflex vertices', () => {
    const lShape = poly(0, 0, 6, 0, 6, 2, 2, 2, 2, 6, 0, 6);
    expect(lShape.map((_, i) => isReflexVertex(lShape, i))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('knows the eight directions and edge lengths', () => {
    expect(directionOf(ip(0, 0), ip(3, 0))).toBe('horizontal');
    expect(directionOf(ip(0, 0), ip(0, -3))).toBe('vertical');
    expect(directionOf(ip(0, 0), [0, 1, 0, -1])).toBe('diagonal');
    expect(directionOf(ip(0, 0), ip(2, 1))).toBeNull();
    expect(directionOf(ip(1, 1), ip(1, 1))).toBeNull();
    expect(edgeLength(ip(0, 0), ip(2, 2))).toEqual([0, 2] as Z2); // 2√2
  });
});

describe('edge ticks (§5「吸着」)', () => {
  const keys = (a: Pt, b: Pt) => edgeTicks(a, b).map((t) => ptKey(t.point));
  it('puts ticks 2m + 2n√2 from either end, each once, ordered from the start', () => {
    // A horizontal edge of length 4: from the start 0, 2, 2√2, 4; from the end 4 − 2√2.
    expect(keys(ip(0, 0), ip(4, 0))).toEqual([
      '0,0,0,0',
      '4,-2,0,0', // 4 − 2√2 ≈ 1.17
      '2,0,0,0',
      '0,2,0,0', // 2√2 ≈ 2.83
      '4,0,0,0',
    ]);
  });

  it('keeps ticks on a diagonal exact: (2m + 2n√2)/√2 = m√2 + 2n', () => {
    // From (0, 0) to (2√2, 2√2): length 4.
    const ticks = edgeTicks(ip(0, 0), [0, 2, 0, 2]);
    expect(ticks.map((t) => ptKey(t.point))).toEqual([
      '0,0,0,0',
      '-2,2,-2,2', // 2√2 from the end: 4 − 2√2 ≈ 1.17 from the start
      '0,1,0,1', // 2 from the start, and 2 from the end: one tick
      '2,0,2,0', // 2√2 from the start
      '0,2,0,2',
    ]);
    for (const tick of ticks) expect(tick.point.every(Number.isInteger)).toBe(true);
  });

  it('counts the ticks the rules quote (§5「範囲と仕事量」)', () => {
    // Ticks measured from the start only (2m + 2n√2 with m, n ≥ 0), ends included:
    // 21 on an axis edge of length 13 and 38 on a diagonal of length 13√2. With an
    // odd length no tick counted from the far end has that form, so the filter
    // keeps exactly the start's.
    const fromStartOnly = (a: Pt, b: Pt) =>
      edgeTicks(a, b).filter(
        ({ fromStart: [m2, n2] }) => m2 >= 0 && n2 >= 0 && m2 % 2 === 0 && n2 % 2 === 0,
      ).length;
    expect(fromStartOnly(ip(0, 0), ip(13, 0))).toBe(21);
    expect(fromStartOnly(ip(0, 0), ip(13, 13))).toBe(38);
  });

  it('recognises ticks and rejects other boundary points', () => {
    expect(isTickOf(ip(2, 0), ip(0, 0), ip(4, 0))).toBe(true);
    expect(isTickOf(ip(1, 0), ip(0, 0), ip(4, 0))).toBe(false);
    expect(isTickOf([4, -2, 0, 0], ip(0, 0), ip(4, 0))).toBe(true);
  });
});
