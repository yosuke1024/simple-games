/**
 * Z[√2] arithmetic (docs/TANGRAM_RULES.md §5「単位と数」, §13).
 */
import { describe, expect, it } from 'vitest';
import { add, cmp, cross, eq, mul, sign, sub, toFloat, type Z2 } from './z2';

describe('Z[√2] arithmetic (§5)', () => {
  it('adds, subtracts and multiplies part by part', () => {
    expect(add([3, -2], [-1, 5])).toEqual([2, 3]);
    expect(sub([3, -2], [-1, 5])).toEqual([4, -7]);
    // (1 + √2)(1 − √2) = 1 − 2 = −1
    expect(mul([1, 1], [1, -1])).toEqual([-1, 0]);
    // (2 + 3√2)(4 − √2) = 8 − 6 + (−2 + 12)√2 = 2 + 10√2
    expect(mul([2, 3], [4, -1])).toEqual([2, 10]);
    // √2 · √2 = 2
    expect(mul([0, 1], [0, 1])).toEqual([2, 0]);
  });

  it('is equal only when both parts are', () => {
    expect(eq([2, 0], [2, 0])).toBe(true);
    expect(eq([2, 0], [0, 1])).toBe(false);
    expect(eq([0, 2], [0, 2])).toBe(true);
  });

  it('knows the sign of same-signed parts at once', () => {
    expect(sign([0, 0])).toBe(0);
    expect(sign([3, 0])).toBe(1);
    expect(sign([0, 3])).toBe(1);
    expect(sign([-3, 0])).toBe(-1);
    expect(sign([0, -3])).toBe(-1);
    expect(sign([2, 5])).toBe(1);
    expect(sign([-2, -5])).toBe(-1);
  });

  it('decides mixed signs exactly, even within 10⁻⁴ of zero', () => {
    // 99 − 70√2 ≈ +0.00505, 140 − 99√2 ≈ −0.00714, 577 − 408√2 ≈ +0.00087
    expect(sign([99, -70])).toBe(1);
    expect(sign([140, -99])).toBe(-1);
    expect(sign([577, -408])).toBe(1);
    expect(sign([-577, 408])).toBe(-1);
    expect(sign([-99, 70])).toBe(-1);
    expect(sign([-140, 99])).toBe(1);
    // 19601 − 13860√2 ≈ +2.6 × 10⁻⁵
    expect(sign([19601, -13860])).toBe(1);
    expect(sign([-19601, 13860])).toBe(-1);
  });

  it('orders numbers by the sign of their difference', () => {
    expect(cmp([0, 1], [1, 0])).toBe(1); // √2 > 1
    expect(cmp([0, 1], [2, 0])).toBe(-1); // √2 < 2
    expect(cmp([3, 2], [3, 2])).toBe(0);
    const values: Z2[] = [
      [0, 1],
      [2, 0],
      [1, 0],
      [-1, 1],
      [3, -2],
      [0, 0],
    ];
    const sorted = [...values].sort(cmp);
    const floats = sorted.map(toFloat);
    expect([...floats].sort((a, b) => a - b)).toEqual(floats);
  });

  it('stays exact at the largest values the rules allow (§5「範囲」)', () => {
    // Coordinates within ±256, scaled by 4 for containment and differenced:
    // parts up to 2,048 in a cross product, whose parts reach 2.5 × 10⁷, and the
    // sign squares them to about 6.3 × 10¹⁴ — inside 2⁵³.
    const big = 2048;
    const p = mul([big, big], [big, big]); // (2048 + 2048√2)²
    expect(p).toEqual([3 * big * big, 2 * big * big]);
    const c = cross(
      [-1024, -1024, -1024, -1024],
      [1024, 1024, -1024, -1024],
      [1024, 1024, 1024, 1024],
    );
    expect(Math.abs(c[0])).toBeLessThan(2 ** 53);
    expect(sign(c)).toBe(1);
    const nearZero: Z2 = [c[0], -Math.round(c[0] / Math.SQRT2)];
    const exact = nearZero[0] * nearZero[0] - 2 * nearZero[1] * nearZero[1];
    expect(Number.isSafeInteger(nearZero[0] * nearZero[0])).toBe(true);
    expect(sign(nearZero)).toBe(Math.sign(exact));
    // A mixed-sign pair as large as a squared cross product at the bound gets: a ≈ 2.5 × 10⁷.
    const a = 3 * big * big * 2;
    const b = -Math.floor(a / Math.SQRT2);
    expect(Number.isSafeInteger(a * a)).toBe(true);
    expect(Number.isSafeInteger(2 * b * b)).toBe(true);
    expect(sign([a, b])).toBe(Math.sign(a * a - 2 * b * b));
    expect(sign([a, b - 1])).toBe(-1);
  });
});
