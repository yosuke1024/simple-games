/**
 * Exact numbers of the form a + b√2 with whole a and b — the ring Z[√2]
 * (docs/TANGRAM_RULES.md §5「単位と数」). Every coordinate the rules judge or
 * store is one of these, so "do these two vertices meet?" and "is this edge
 * inside the silhouette?" are answered with integer arithmetic, never with a
 * rounded float.
 *
 * √2 is irrational, so a number has exactly one pair (a, b): equality is
 * equality of both parts. The sign of a + b√2 is the sign of a and b when
 * they agree, and otherwise the sign of a² − 2b² (or 2b² − a²), which no
 * pair of whole numbers but (0, 0) makes 0.
 *
 * The rules keep every accepted coordinate within ±256 (§5「範囲」), so the
 * largest intermediate value — a squared cross product in the containment
 * test — stays near 6.3 × 10¹⁴, inside JavaScript's safe integers (2⁵³).
 * z2.test.ts checks the sign at that bound. No BigInt.
 */

/** a + b√2, stored as the pair [a, b]. */
export type Z2 = readonly [a: number, b: number];

/** A point (x, y), y pointing down the screen: x = xa + xb√2, y = ya + yb√2. */
export type Pt = readonly [xa: number, xb: number, ya: number, yb: number];

export const Z2_ZERO: Z2 = [0, 0];
export const SQRT2_F = Math.SQRT2;

export const z2 = (a: number, b = 0): Z2 => [a, b];
export const add = (p: Z2, q: Z2): Z2 => [p[0] + q[0], p[1] + q[1]];
export const sub = (p: Z2, q: Z2): Z2 => [p[0] - q[0], p[1] - q[1]];
export const neg = (p: Z2): Z2 => [0 - p[0], 0 - p[1]];
/** (a + b√2)(c + d√2) = (ac + 2bd) + (ad + bc)√2. */
export const mul = (p: Z2, q: Z2): Z2 => [
  p[0] * q[0] + 2 * p[1] * q[1] + 0,
  p[0] * q[1] + p[1] * q[0] + 0,
];
export const eq = (p: Z2, q: Z2): boolean => p[0] === q[0] && p[1] === q[1];
export const isZero = (p: Z2): boolean => p[0] === 0 && p[1] === 0;

/** −1, 0 or 1: the exact sign of a + b√2 (§5「符号」). */
export function sign(p: Z2): -1 | 0 | 1 {
  const [a, b] = p;
  if (a >= 0 && b >= 0) return a > 0 || b > 0 ? 1 : 0;
  if (a <= 0 && b <= 0) return -1;
  // The parts disagree, so neither is 0 and a² ≠ 2b².
  if (a > 0) return a * a > 2 * b * b ? 1 : -1;
  return 2 * b * b > a * a ? 1 : -1;
}

/** −1, 0 or 1 as p is less than, equal to, or greater than q. */
export const cmp = (p: Z2, q: Z2): -1 | 0 | 1 => sign(sub(p, q));
export const lt = (p: Z2, q: Z2): boolean => cmp(p, q) < 0;
export const le = (p: Z2, q: Z2): boolean => cmp(p, q) <= 0;
export const abs = (p: Z2): Z2 => (sign(p) < 0 ? neg(p) : p);
export const min = (p: Z2, q: Z2): Z2 => (lt(q, p) ? q : p);
export const max = (p: Z2, q: Z2): Z2 => (lt(p, q) ? q : p);

/** The nearest float — for drawing and for ranking snap candidates only (§5). */
export const toFloat = (p: Z2): number => p[0] + p[1] * SQRT2_F;

// ---------------------------------------------------------------- points

export const pt = (x: Z2, y: Z2): Pt => [x[0], x[1], y[0], y[1]];
export const ptX = (p: Pt): Z2 => [p[0], p[1]];
export const ptY = (p: Pt): Z2 => [p[2], p[3]];
export const ptAdd = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1], p[2] + q[2], p[3] + q[3]];
export const ptSub = (p: Pt, q: Pt): Pt => [p[0] - q[0], p[1] - q[1], p[2] - q[2], p[3] - q[3]];
export const ptScale = (p: Pt, k: number): Pt => [p[0] * k, p[1] * k, p[2] * k, p[3] * k];
export const ptEq = (p: Pt, q: Pt): boolean =>
  p[0] === q[0] && p[1] === q[1] && p[2] === q[2] && p[3] === q[3];
export const ptKey = (p: Pt): string => `${p[0]},${p[1]},${p[2]},${p[3]}`;
export const ptToFloat = (p: Pt): readonly [x: number, y: number] => [
  p[0] + p[1] * SQRT2_F,
  p[2] + p[3] * SQRT2_F,
];

/** The z component of (b − a) × (c − a): its sign says which side of a→b the point c is on. */
export function cross(a: Pt, b: Pt, c: Pt): Z2 {
  const ux = sub(ptX(b), ptX(a));
  const uy = sub(ptY(b), ptY(a));
  const vx = sub(ptX(c), ptX(a));
  const vy = sub(ptY(c), ptY(a));
  return sub(mul(ux, vy), mul(uy, vx));
}

/** Whether every part of the point is a whole number of at most `limit` in size (§5「範囲」). */
export function isBoundedPoint(p: Pt, limit: number): boolean {
  return p.every((v) => Number.isInteger(v) && Math.abs(v) <= limit);
}

/** Rational parts even — every vertex a snap can produce has them (§5「吸着」の補足). */
export const hasEvenRationalParts = (p: Pt): boolean => p[0] % 2 === 0 && p[2] % 2 === 0;

/**
 * The lattice the 45° turn maps onto itself (§5「姿」): rational parts even
 * and the √2 parts of the same parity. Every local vertex and edge tick of a
 * piece is in it, so turning a piece about such a point stays exact.
 */
export const isTurnLattice = (p: Pt): boolean =>
  hasEvenRationalParts(p) && Math.abs(p[1] - p[3]) % 2 === 0;
