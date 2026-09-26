/**
 * Scoring (docs/YACHT_RULES.md §3): what five dice are worth in each box.
 *
 * `scoreFor` is the only place a box's points are decided. The sheet's
 * preview of an open box (§9) calls the same function the commit does, so
 * what the player is shown is exactly what they get.
 */
import { CATEGORIES, DICE_COUNT, FACES, type Category, type Dice } from './types';

/** How many dice show each face; index 0 is unused so `counts[face]` reads. */
function faceCounts(dice: Dice): number[] {
  const counts = new Array<number>(FACES + 1).fill(0);
  for (const face of dice) counts[face] = (counts[face] ?? 0) + 1;
  return counts;
}

const sum = (dice: Dice): number => dice.reduce((total, face) => total + face, 0);

/** True when the five dice are exactly the given run, in any order. */
function isRun(counts: readonly number[], from: number): boolean {
  for (let face = from; face < from + DICE_COUNT; face++) {
    if (counts[face] !== 1) return false;
  }
  return true;
}

/**
 * The points five dice score in one box (§3). A box whose condition the dice
 * do not meet scores 0 — choosing it is still a legal way to end the turn (§2).
 */
export function scoreFor(category: Category, dice: Dice): number {
  const counts = faceCounts(dice);
  switch (category) {
    case 'ones':
      return counts[1]! * 1;
    case 'twos':
      return counts[2]! * 2;
    case 'threes':
      return counts[3]! * 3;
    case 'fours':
      return counts[4]! * 4;
    case 'fives':
      return counts[5]! * 5;
    case 'sixes':
      return counts[6]! * 6;
    case 'fullHouse': {
      // Exactly three of one face and two of another: five of a kind is not a
      // full house (§3), because "three and two" names two different faces.
      const shape = counts.filter((count) => count > 0).sort((a, b) => a - b);
      return shape.length === 2 && shape[0] === 2 && shape[1] === 3 ? sum(dice) : 0;
    }
    case 'fourOfAKind': {
      // Four or more of one face, scored as four of it: a Yacht qualifies,
      // and its fifth die does not count (§3).
      const face = counts.findIndex((count) => count >= 4);
      return face > 0 ? face * 4 : 0;
    }
    case 'littleStraight':
      return isRun(counts, 1) ? 30 : 0;
    case 'bigStraight':
      return isRun(counts, 2) ? 30 : 0;
    case 'choice':
      return sum(dice);
    case 'yacht':
      return counts.some((count) => count === DICE_COUNT) ? 50 : 0;
  }
}

/** The sheet's total: every box taken so far, open boxes counting nothing. */
export function sheetTotal(scores: readonly (number | null)[]): number {
  return scores.reduce<number>((total, points) => total + (points ?? 0), 0);
}

/**
 * Every distinct throw, as its sorted faces: the 252 multisets of five dice.
 * Scoring never depends on order, so this is every case there is.
 */
function allThrows(): number[][] {
  const out: number[][] = [];
  const walk = (from: number, prefix: number[]) => {
    if (prefix.length === DICE_COUNT) {
      out.push(prefix);
      return;
    }
    for (let face = from; face <= FACES; face++) walk(face, [...prefix, face]);
  };
  walk(1, []);
  return out;
}

let reachable: readonly ReadonlySet<number>[] | null = null;

/** The points each box can hold, by enumeration — computed once, on first use. */
function reachableScores(): readonly ReadonlySet<number>[] {
  if (reachable === null) {
    const throws = allThrows();
    reachable = CATEGORIES.map((category) => new Set(throws.map((d) => scoreFor(category, d))));
  }
  return reachable;
}

/**
 * Whether some throw scores exactly `value` in `category` — what a saved
 * sheet has to prove about each filled box (§7). Derived from `scoreFor`
 * itself, so the check can never disagree with the scoring.
 */
export function isPossibleScore(category: Category, value: number): boolean {
  const index = CATEGORIES.indexOf(category);
  return reachableScores()[index]?.has(value) ?? false;
}

/**
 * The best a whole game can score: each box is taken on its own turn with
 * its own dice, so the sheet's ceiling is every box's ceiling added up —
 * 5 + 10 + 15 + 20 + 25 + 30 + 28 + 24 + 30 + 30 + 30 + 50 (§3).
 * engine.test.ts derives the same number from every throw there is.
 */
export const MAX_TOTAL = 297;

/** The most one box can hold, by enumeration (for the test that pins MAX_TOTAL). */
export function maxScoreFor(category: Category): number {
  return Math.max(...reachableScores()[CATEGORIES.indexOf(category)]!);
}
