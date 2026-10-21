/**
 * The rules of docs/MAKE_THE_TARGET_RULES.md §1–§2, one by one (§15「規則」).
 */
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyOperator,
  initialSlots,
  isLegalMove,
  lastNumber,
  OPERATOR_SYMBOLS,
  outcomeOf,
  replay,
  tileCount,
} from './engine';
import type { Move, Operator } from './types';

const move = (left: number, op: Operator, right: number): Move => ({ left, op, right });

describe('which merges are legal (§2)', () => {
  it('+ and × are always legal', () => {
    expect(applyOperator('+', 3, 7)).toBe(10);
    expect(applyOperator('+', 7, 3)).toBe(10);
    expect(applyOperator('*', 3, 7)).toBe(21);
    expect(applyOperator('*', 7, 3)).toBe(21);
  });

  it('− only when the left is larger: no 0, no negative', () => {
    expect(applyOperator('-', 7, 3)).toBe(4);
    expect(applyOperator('-', 3, 3)).toBeNull();
    expect(applyOperator('-', 3, 7)).toBeNull();
  });

  it('÷ only when the right divides the left: no fraction', () => {
    expect(applyOperator('/', 8, 2)).toBe(4);
    expect(applyOperator('/', 9, 2)).toBeNull();
    expect(applyOperator('/', 2, 8)).toBeNull();
  });

  it('×1, ÷1 and x ÷ x are legal', () => {
    expect(applyOperator('*', 6, 1)).toBe(6);
    expect(applyOperator('*', 1, 6)).toBe(6);
    expect(applyOperator('/', 6, 1)).toBe(6);
    expect(applyOperator('/', 6, 6)).toBe(1);
  });

  it('every legal result is a whole number of at least 1', () => {
    for (const op of ['+', '-', '*', '/'] as const) {
      for (let x = 1; x <= 30; x++) {
        for (let y = 1; y <= 30; y++) {
          const r = applyOperator(op, x, y);
          if (r === null) continue;
          expect(Number.isInteger(r) && r >= 1, `${x}${op}${y}`).toBe(true);
        }
      }
    }
  });

  it('draws the board’s symbols, not the stored ones (§1)', () => {
    expect(OPERATOR_SYMBOLS).toEqual({ '+': '+', '-': '−', '*': '×', '/': '÷' });
  });
});

describe('slots and moves (§1–§2)', () => {
  it('deals the numbers in ascending order, slot 0 first', () => {
    expect(initialSlots([9, 2, 5, 2])).toEqual([2, 2, 5, 9]);
  });

  it('the order chosen is the direction: the first slot is the left term', () => {
    const slots = initialSlots([3, 7]);
    expect(isLegalMove(slots, move(1, '-', 0))).toBe(true); // 7 − 3
    expect(isLegalMove(slots, move(0, '-', 1))).toBe(false); // 3 − 7
    expect(isLegalMove(initialSlots([2, 8]), move(1, '/', 0))).toBe(true); // 8 ÷ 2
    expect(isLegalMove(initialSlots([2, 8]), move(0, '/', 1))).toBe(false); // 2 ÷ 8
  });

  it('puts the result in the right term’s slot and empties the left term’s', () => {
    expect(applyMove([1, 2, 3, 4], move(2, '*', 0))).toEqual([3, 2, null, 4]);
    expect(applyMove([1, 2, 3, 4], move(0, '+', 3))).toEqual([null, 2, 3, 5]);
  });

  it('refuses the same slot twice, a slot off the board and an empty slot', () => {
    const slots = [null, 2, 3, 4];
    expect(isLegalMove(slots, move(1, '+', 1))).toBe(false);
    expect(isLegalMove(slots, move(1, '+', 4))).toBe(false);
    expect(isLegalMove(slots, move(-1, '+', 2))).toBe(false);
    expect(isLegalMove(slots, move(1.5, '+', 2))).toBe(false);
    expect(isLegalMove(slots, move(0, '+', 2))).toBe(false);
    expect(isLegalMove(slots, move(2, '+', 0))).toBe(false);
    expect(applyMove(slots, move(0, '+', 2))).toBeNull();
  });

  it('n tiles take exactly n−1 moves to become one, and + is always there to play', () => {
    for (const numbers of [
      [1, 2],
      [5, 5, 5],
      [1, 2, 3, 4],
      [3, 9, 9, 10, 25],
      [1, 1, 1, 1, 1, 1],
    ]) {
      let slots: (number | null)[] = initialSlots(numbers);
      let moves = 0;
      while (tileCount(slots) > 1) {
        const filled = slots.flatMap((v, s) => (v === null ? [] : [s]));
        slots = applyMove(slots, move(filled[0]!, '+', filled[1]!))!;
        moves++;
      }
      expect(moves).toBe(numbers.length - 1);
      expect(lastNumber(slots)).toBe(numbers.reduce((a, b) => a + b, 0));
    }
  });
});

describe('how a board stands (§2)', () => {
  it('is solved when the last number equals the target, missed when it does not', () => {
    expect(outcomeOf([null, null, 21, null], 21)).toBe('solved');
    expect(outcomeOf([null, null, 20, null], 21)).toBe('missed');
  });

  it('a number equal to the target is nothing while others remain', () => {
    expect(outcomeOf([21, 1, null, null], 21)).toBe('playing');
    expect(lastNumber([21, 1, null, null])).toBeNull();
  });

  it('replays moves into expressions and stops at the first illegal one', () => {
    const played = replay([1, 2, 3, 4], [move(0, '+', 1), move(2, '+', 3), move(1, '*', 3)])!;
    expect(played.slots).toEqual([null, null, null, 21]);
    expect(played.expressions).toEqual([
      { left: 1, op: '+', right: 2, result: 3 },
      { left: 3, op: '+', right: 4, result: 7 },
      { left: 3, op: '*', right: 7, result: 21 },
    ]);
    expect(replay([1, 2, 3, 4], [move(0, '+', 1), move(0, '+', 2)])).toBeNull();
  });
});
