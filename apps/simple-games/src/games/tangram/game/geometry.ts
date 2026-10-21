/**
 * Exact judgements on polygons whose edges run in the eight 45° directions
 * (docs/TANGRAM_RULES.md §5「判定」). No float is used here.
 *
 * Every piece is convex and every edge — of a piece or of a silhouette —
 * runs along one of eight directions, so four axes separate any two shapes:
 * x, y, x + y and x − y. Each projection is a Z[√2] number.
 *
 * One predicate, `strictlyOverlap`, decides both overlap and containment:
 * [a₀, a₁] and [b₀, b₁] strictly overlap when a₀ < b₁ and b₀ < a₁. Written as
 * max < min it would never hold for a one-point interval (p < p), and a
 * segment projects to one point on its own normal — so containment's
 * condition 1 would silently pass any edge through a piece (§5「区間の厳密な
 * 重なり」).
 */
import {
  abs,
  add,
  cross,
  eq,
  isZero,
  le,
  lt,
  max,
  min,
  mul,
  ptAdd,
  ptKey,
  ptScale,
  ptX,
  ptY,
  sign,
  sub,
  type Pt,
  type Z2,
} from './z2';

/** The four separating axes: x, y, x + y, x − y (§5「判定」). */
export const AXES = 4;

export function project(p: Pt, axis: number): Z2 {
  const x = ptX(p);
  const y = ptY(p);
  switch (axis) {
    case 0:
      return x;
    case 1:
      return y;
    case 2:
      return add(x, y);
    default:
      return sub(x, y);
  }
}

export type Interval = readonly [lo: Z2, hi: Z2];

export function interval(points: readonly Pt[], axis: number): Interval {
  let lo = project(points[0]!, axis);
  let hi = lo;
  for (let i = 1; i < points.length; i++) {
    const v = project(points[i]!, axis);
    lo = min(lo, v);
    hi = max(hi, v);
  }
  return [lo, hi];
}

/** a₀ < b₁ and b₀ < a₁ — true for a one-point interval strictly inside the other (§5). */
export const strictlyOverlap = (a: Interval, b: Interval): boolean =>
  lt(a[0], b[1]) && lt(b[0], a[1]);

/** Whether two convex polygons share interior points: strict overlap on all four axes (§5「重なり」). */
export function convexOverlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (let axis = 0; axis < AXES; axis++) {
    if (!strictlyOverlap(interval(a, axis), interval(b, axis))) return false;
  }
  return true;
}

/** Whether segment p–q passes through the interior of convex polygon `piece` (§5「内包」1). */
export function segmentCrossesInterior(p: Pt, q: Pt, piece: readonly Pt[]): boolean {
  return convexOverlap([p, q], piece);
}

/**
 * Crossing-number test for a point not on the polygon's boundary, half-open
 * in y (an edge counts when exactly one end lies strictly below the point's
 * line), with the side of each edge decided by the exact cross product.
 */
export function pointInPolygon(q: Pt, polygon: readonly Pt[]): boolean {
  let inside = false;
  const qy = ptY(q);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const aBelow = lt(qy, ptY(a));
    const bBelow = lt(qy, ptY(b));
    if (aBelow === bBelow) continue;
    // The edge crosses the horizontal line through q; is the crossing right of q?
    const dy = sign(sub(ptY(b), ptY(a)));
    const side = sign(cross(a, b, q));
    if (side !== 0 && side === dy) inside = !inside;
  }
  return inside;
}

/**
 * 4 × a point strictly inside a convex piece: 2·v₀ + v₁ + v₂ for a triangle,
 * v₀ + v₁ + v₂ + v₃ for a quadrilateral (positive weights summing to 4).
 */
export function fourTimesInteriorPoint(piece: readonly Pt[]): Pt {
  if (piece.length === 3) return ptAdd(ptAdd(ptScale(piece[0]!, 2), piece[1]!), piece[2]!);
  return piece.reduce((sum, v) => ptAdd(sum, v), [0, 0, 0, 0] as Pt);
}

/**
 * Whether convex `piece` lies inside the simple polygon `outline` (§5「内包」):
 * (1) no outline edge passes through the piece's interior, and (2) one interior
 * point of the piece is inside the outline (tested at 4× scale, no fractions).
 * Touching the outline along an edge or at a vertex is inside.
 */
export function convexInside(piece: readonly Pt[], outline: readonly Pt[]): boolean {
  for (let i = 0; i < outline.length; i++) {
    if (segmentCrossesInterior(outline[i]!, outline[(i + 1) % outline.length]!, piece)) {
      return false;
    }
  }
  const scaled = outline.map((v) => ptScale(v, 4));
  return pointInPolygon(fourTimesInteriorPoint(piece), scaled);
}

/** Twice the signed area (shoelace); positive is clockwise on screen (y down). */
export function doubledArea(polygon: readonly Pt[]): Z2 {
  let sum: Z2 = [0, 0];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    sum = add(sum, sub(mul(ptX(a), ptY(b)), mul(ptX(b), ptY(a))));
  }
  return sum;
}

// ---------------------------------------------------------------- edges

export type Direction = 'horizontal' | 'vertical' | 'diagonal';

/** Which of the eight directions a→b runs in, or null for any other (or a zero-length edge). */
export function directionOf(a: Pt, b: Pt): Direction | null {
  const dx = sub(ptX(b), ptX(a));
  const dy = sub(ptY(b), ptY(a));
  if (isZero(dx) && isZero(dy)) return null;
  if (isZero(dy)) return 'horizontal';
  if (isZero(dx)) return 'vertical';
  return eq(abs(dx), abs(dy)) ? 'diagonal' : null;
}

/** An edge's length (exact): |Δ| along an axis, |Δx|·√2 on a diagonal. */
export function edgeLength(a: Pt, b: Pt): Z2 | null {
  const direction = directionOf(a, b);
  if (!direction) return null;
  const dx = abs(sub(ptX(b), ptX(a)));
  const dy = abs(sub(ptY(b), ptY(a)));
  if (direction === 'horizontal') return dx;
  if (direction === 'vertical') return dy;
  return mul(dx, [0, 1]);
}

export interface Tick {
  readonly point: Pt;
  /** Distance from the edge's start, exact. */
  readonly fromStart: Z2;
}

/**
 * The edge's ticks (§5「吸着」): the points 2m + 2n√2 units (m, n ≥ 0) from
 * either end that lie on the edge, ends included, each point once, ordered
 * by distance from the start. Every piece edge is such a length, so ticks are
 * where a piece's corner can meet the edge with the rest of the edge still
 * divisible into piece edges. Every tick is a Z[√2] point: along a diagonal
 * the step (2m + 2n√2)/√2 is m√2 + 2n.
 */
export function edgeTicks(a: Pt, b: Pt): Tick[] {
  const direction = directionOf(a, b);
  const length = edgeLength(a, b);
  if (!direction || !length) return [];
  const sx = sign(sub(ptX(b), ptX(a)));
  const sy = sign(sub(ptY(b), ptY(a)));
  const step = (s: Z2): readonly [Z2, Z2] => {
    if (direction === 'horizontal') return [mul(s, [sx, 0]), [0, 0]];
    if (direction === 'vertical') return [[0, 0], mul(s, [sy, 0])];
    // s/√2 for s = 2m + 2n√2 is 2n + m√2.
    const half: Z2 = [s[1], s[0] / 2];
    return [mul(half, [sx, 0]), mul(half, [sy, 0])];
  };
  const shift = (p: Pt, d: readonly [Z2, Z2], k: number): Pt => [
    p[0] + k * d[0][0],
    p[1] + k * d[0][1],
    p[2] + k * d[1][0],
    p[3] + k * d[1][1],
  ];
  const seen = new Set<string>();
  const ticks: Tick[] = [];
  const push = (point: Pt, fromStart: Z2) => {
    const key = ptKey(point);
    if (seen.has(key)) return;
    seen.add(key);
    ticks.push({ point, fromStart });
  };
  for (let n = 0; le([0, 2 * n], length); n++) {
    for (let m = 0; ; m++) {
      const s: Z2 = [2 * m, 2 * n];
      if (!le(s, length)) break;
      const d = step(s);
      push(shift(a, d, 1), s);
      push(shift(b, d, -1), sub(length, s));
    }
  }
  return ticks.sort((p, q) => sign(sub(p.fromStart, q.fromStart)));
}

/** Whether point p is one of the edge's ticks. */
export function isTickOf(p: Pt, a: Pt, b: Pt): boolean {
  const key = ptKey(p);
  return edgeTicks(a, b).some((tick) => ptKey(tick.point) === key);
}

// ---------------------------------------------------------------- outlines

/** Whether closed segments p1–p2 and q1–q2 share any point (exact). */
export function segmentsTouch(p1: Pt, p2: Pt, q1: Pt, q2: Pt): boolean {
  const d1 = sign(cross(q1, q2, p1));
  const d2 = sign(cross(q1, q2, p2));
  const d3 = sign(cross(p1, p2, q1));
  const d4 = sign(cross(p1, p2, q2));
  if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  const onSegment = (a: Pt, b: Pt, c: Pt) =>
    le(min(ptX(a), ptX(b)), ptX(c)) &&
    le(ptX(c), max(ptX(a), ptX(b))) &&
    le(min(ptY(a), ptY(b)), ptY(c)) &&
    le(ptY(c), max(ptY(a), ptY(b)));
  return (
    (d1 === 0 && onSegment(q1, q2, p1)) ||
    (d2 === 0 && onSegment(q1, q2, p2)) ||
    (d3 === 0 && onSegment(p1, p2, q1)) ||
    (d4 === 0 && onSegment(p1, p2, q2))
  );
}

/**
 * Whether a closed polyline is a simple polygon (§2): no vertex twice,
 * non-adjacent edges share no point (ends included), adjacent edges meet only
 * at their shared vertex.
 */
export function isSimplePolygon(polygon: readonly Pt[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;
  if (new Set(polygon.map(ptKey)).size !== n) return false;
  for (let i = 0; i < n; i++) {
    const a1 = polygon[i]!;
    const a2 = polygon[(i + 1) % n]!;
    for (let j = i + 1; j < n; j++) {
      const b1 = polygon[j]!;
      const b2 = polygon[(j + 1) % n]!;
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (!adjacent) {
        if (segmentsTouch(a1, a2, b1, b2)) return false;
        continue;
      }
      // Adjacent edges: they share one vertex; they must not fold back over each other.
      const shared = j === i + 1 ? a2 : a1;
      const aOther = j === i + 1 ? a1 : a2;
      const bOther = j === i + 1 ? b2 : b1;
      if (sign(cross(shared, aOther, bOther)) === 0) {
        // Collinear: fine only when they leave the shared vertex in opposite directions.
        const ax = sub(ptX(aOther), ptX(shared));
        const ay = sub(ptY(aOther), ptY(shared));
        const bx = sub(ptX(bOther), ptX(shared));
        const by = sub(ptY(bOther), ptY(shared));
        if (sign(add(mul(ax, bx), mul(ay, by))) > 0) return false;
      }
    }
  }
  return true;
}

/** Interior angle > 180° at vertex i of a clockwise-on-screen polygon. */
export function isReflexVertex(polygon: readonly Pt[], i: number): boolean {
  const n = polygon.length;
  const prev = polygon[(i + n - 1) % n]!;
  const here = polygon[i]!;
  const next = polygon[(i + 1) % n]!;
  // With y down, a clockwise-on-screen turn has a positive cross product.
  return sign(cross(prev, here, next)) < 0;
}

/** Whether vertex i lies on the straight line through its neighbours (a redundant vertex). */
export function isStraightVertex(polygon: readonly Pt[], i: number): boolean {
  const n = polygon.length;
  return sign(cross(polygon[(i + n - 1) % n]!, polygon[i]!, polygon[(i + 1) % n]!)) === 0;
}
