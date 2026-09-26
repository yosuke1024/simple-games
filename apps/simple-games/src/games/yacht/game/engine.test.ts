/**
 * Every box's points (docs/YACHT_RULES.md §3), table-driven, with the
 * boundaries the rules name spelled out: a Yacht is also four of a kind, and
 * five of a kind is not a full house.
 */
import { describe, expect, it } from 'vitest';
import { isPossibleScore, MAX_TOTAL, maxScoreFor, scoreFor, sheetTotal } from './engine';
import { CATEGORIES, type Category } from './types';

type Row = readonly [Category, readonly number[], number];

const TABLE: readonly Row[] = [
  // Upper boxes: the matching faces added up, zero when there are none.
  ['ones', [1, 1, 2, 3, 1], 3],
  ['ones', [2, 3, 4, 5, 6], 0],
  ['twos', [2, 2, 2, 2, 2], 10],
  ['threes', [3, 1, 3, 6, 6], 6],
  ['fours', [4, 4, 4, 4, 1], 16],
  ['fives', [5, 1, 2, 3, 4], 5],
  ['sixes', [6, 6, 6, 6, 6], 30],
  ['sixes', [1, 2, 3, 4, 5], 0],

  // Full House: exactly three and two, scored as the five dice's sum.
  ['fullHouse', [3, 3, 3, 5, 5], 19],
  ['fullHouse', [6, 5, 6, 5, 6], 28],
  ['fullHouse', [1, 1, 2, 2, 1], 7],
  // Five of a kind is not three and two of different faces (§3).
  ['fullHouse', [4, 4, 4, 4, 4], 0],
  ['fullHouse', [4, 4, 4, 4, 2], 0],
  ['fullHouse', [2, 2, 3, 3, 5], 0],
  ['fullHouse', [1, 2, 3, 4, 5], 0],

  // Four of a Kind: four times the face; the fifth die never counts.
  ['fourOfAKind', [2, 2, 2, 2, 6], 8],
  ['fourOfAKind', [6, 1, 6, 6, 6], 24],
  // A Yacht qualifies, still scored as four (§3).
  ['fourOfAKind', [5, 5, 5, 5, 5], 20],
  ['fourOfAKind', [3, 3, 3, 1, 1], 0],

  // Straights: fixed 30, exactly the run, in any order.
  ['littleStraight', [1, 2, 3, 4, 5], 30],
  ['littleStraight', [5, 3, 1, 4, 2], 30],
  ['littleStraight', [2, 3, 4, 5, 6], 0],
  ['littleStraight', [1, 2, 3, 4, 4], 0],
  ['bigStraight', [2, 3, 4, 5, 6], 30],
  ['bigStraight', [6, 4, 2, 5, 3], 30],
  ['bigStraight', [1, 2, 3, 4, 5], 0],
  ['bigStraight', [2, 3, 4, 5, 5], 0],

  // Choice: always the sum.
  ['choice', [1, 1, 1, 1, 1], 5],
  ['choice', [6, 6, 6, 6, 6], 30],
  ['choice', [1, 2, 3, 4, 6], 16],

  // Yacht: five of a kind, 50 — anything less is nothing.
  ['yacht', [1, 1, 1, 1, 1], 50],
  ['yacht', [6, 6, 6, 6, 6], 50],
  ['yacht', [6, 6, 6, 6, 5], 0],
];

describe('scoring each box (§3)', () => {
  it.each(TABLE)('%s scores %j as %i', (category, dice, points) => {
    expect(scoreFor(category, dice)).toBe(points);
  });

  it('covers every box in the table', () => {
    // A box missing from the table would pass by omission.
    expect(new Set(TABLE.map(([category]) => category))).toEqual(new Set(CATEGORIES));
  });

  it('never depends on the order of the dice', () => {
    const dice = [3, 3, 5, 5, 3];
    const reversed = [...dice].reverse();
    for (const category of CATEGORIES) {
      expect(scoreFor(category, reversed)).toBe(scoreFor(category, dice));
    }
  });
});

describe('what a box can hold', () => {
  it('knows the values some throw can score, and only those (§7)', () => {
    expect(isPossibleScore('fours', 12)).toBe(true);
    expect(isPossibleScore('fours', 13)).toBe(false);
    expect(isPossibleScore('fours', 24)).toBe(false);
    expect(isPossibleScore('fullHouse', 0)).toBe(true);
    expect(isPossibleScore('fullHouse', 7)).toBe(true);
    expect(isPossibleScore('fullHouse', 28)).toBe(true);
    expect(isPossibleScore('fullHouse', 29)).toBe(false);
    expect(isPossibleScore('fullHouse', 5)).toBe(false);
    expect(isPossibleScore('fourOfAKind', 20)).toBe(true);
    expect(isPossibleScore('fourOfAKind', 21)).toBe(false);
    expect(isPossibleScore('littleStraight', 15)).toBe(false);
    expect(isPossibleScore('choice', 4)).toBe(false);
    expect(isPossibleScore('choice', 5)).toBe(true);
    expect(isPossibleScore('yacht', 50)).toBe(true);
    expect(isPossibleScore('yacht', 25)).toBe(false);
  });

  it('adds up to the maximum the rules state (§3)', () => {
    // Each box is taken on its own turn with its own dice, so the ceiling of
    // the sheet is the sum of every box's ceiling, found here by listing
    // every throw there is rather than by trusting the constant.
    expect(CATEGORIES.map(maxScoreFor)).toEqual([5, 10, 15, 20, 25, 30, 28, 24, 30, 30, 30, 50]);
    const derived = CATEGORIES.reduce((total, category) => total + maxScoreFor(category), 0);
    expect(MAX_TOTAL).toBe(derived);
    expect(MAX_TOTAL).toBe(297);
  });

  it('totals only the boxes that are filled', () => {
    expect(sheetTotal([null, 4, null, 12, 0, null, null, null, 30, null, null, 50])).toBe(96);
    expect(sheetTotal(new Array<number | null>(12).fill(null))).toBe(0);
  });
});
