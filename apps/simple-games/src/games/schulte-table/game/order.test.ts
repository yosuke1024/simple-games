import { describe, expect, it } from 'vitest';
import { orderSequence, rankOf, targetAt } from './order';
import { cellCount, ORDERS, SIZES } from './types';

describe('tap orders (docs/SCHULTE_TABLE_RULES.md §5)', () => {
  it('is a permutation of 1..count for every order and size', () => {
    for (const size of SIZES) {
      const count = cellCount(size);
      for (const order of ORDERS) {
        const sequence = orderSequence(order, count);
        expect(sequence).toHaveLength(count);
        expect([...sequence].sort((a, b) => a - b)).toEqual(
          Array.from({ length: count }, (_, i) => i + 1),
        );
      }
    }
  });

  it('rankOf inverts targetAt over the whole domain', () => {
    // The property that matters: get one of the two formulas wrong and a board
    // stops being finishable, because "what is next" and "have I done this one"
    // would disagree.
    for (const size of SIZES) {
      const count = cellCount(size);
      for (const order of ORDERS) {
        for (let index = 0; index < count; index++) {
          expect(rankOf(order, count, targetAt(order, count, index))).toBe(index);
        }
        for (let value = 1; value <= count; value++) {
          expect(targetAt(order, count, rankOf(order, count, value))).toBe(value);
        }
      }
    }
  });

  it('spells out the three orders on a 3x3', () => {
    expect(orderSequence('ascending', 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(orderSequence('descending', 9)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(orderSequence('oddThenEven', 9)).toEqual([1, 3, 5, 7, 9, 2, 4, 6, 8]);
  });

  it('turns over at the right place on an even count', () => {
    // 16 cells: eight odds, then eight evens.
    expect(orderSequence('oddThenEven', 16)).toEqual([
      1, 3, 5, 7, 9, 11, 13, 15, 2, 4, 6, 8, 10, 12, 14, 16,
    ]);
  });
});
