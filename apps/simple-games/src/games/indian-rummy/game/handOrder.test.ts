import { describe, expect, it } from 'vitest';
import { createSession } from './index';
import { arrangeHand, isArrangementOf, moveCard, sameOrder, sortHand } from './handOrder';

describe('hand arrangement', () => {
  it('sorts the way every hand was shown before arranging existed', () => {
    const hand = createSession(5).hands[0]!;
    expect(sortHand(hand)).toEqual([...hand].sort((a, b) => (a % 52) - (b % 52) || a - b));
    // Both copies of a card sit together, the first deck's first.
    expect(sortHand([52 + 3, 104, 3, 0])).toEqual([0, 104, 3, 55]);
  });

  it('follows the hand: a discard closes its gap and a draw joins at the right end', () => {
    const order = [9, 3, 7, 1];
    expect(arrangeHand(order, [1, 3, 7, 9])).toEqual(order);
    expect(arrangeHand(order, [1, 3, 9])).toEqual([9, 3, 1]);
    expect(arrangeHand(order, [1, 3, 7, 9, 40])).toEqual([9, 3, 7, 1, 40]);
    // Duplicates and cards that left are never shown.
    expect(arrangeHand([9, 9, 3, 50, 7, 1], [1, 3, 7, 9])).toEqual(order);
  });

  it('starts again from the sorted hand for an order of some other deal', () => {
    const first = createSession(1).hands[0]!,
      next = createSession(2).hands[0]!;
    expect(arrangeHand(first, next)).toEqual(sortHand(next));
    expect(arrangeHand([], next)).toEqual(sortHand(next));
  });

  it('moves one card to a place, clamped to the hand', () => {
    expect(moveCard([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4]);
    expect(moveCard([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3]);
    expect(moveCard([1, 2, 3, 4], 2, 99)).toEqual([1, 3, 4, 2]);
    expect(moveCard([1, 2, 3, 4], 8, 0)).toEqual([1, 2, 3, 4]);
    expect(sameOrder([1, 2], [1, 2])).toBe(true);
    expect(sameOrder([1, 2], [2, 1])).toBe(false);
  });

  it('accepts only an order of exactly this hand', () => {
    expect(isArrangementOf([3, 1, 2], [1, 2, 3])).toBe(true);
    expect(isArrangementOf([3, 1], [1, 2, 3])).toBe(false);
    expect(isArrangementOf([3, 1, 1], [1, 2, 3])).toBe(false);
    expect(isArrangementOf([3, 1, 4], [1, 2, 3])).toBe(false);
    expect(isArrangementOf('3,1,2', [1, 2, 3])).toBe(false);
  });
});
