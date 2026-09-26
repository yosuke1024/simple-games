/**
 * Core Yacht types. See docs/YACHT_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * Five dice, three throws a turn, twelve boxes on the sheet (§1). The board
 * carries pips and ASCII digits only; the box names are the one thing a
 * locale translates (docs/I18N_POLICY.md).
 */

/** Five dice, and only five (§1). */
export const DICE_COUNT = 5;

/** A die shows 1..6. */
export const FACES = 6;

/** At most three throws in a turn (§2). */
export const ROLLS_PER_TURN = 3;

/**
 * The twelve boxes, in the sheet's own order: the upper six by face, then the
 * combinations (§3). The index in this list is the index in `scores`, so the
 * order is part of the saved format (§7) — never reorder it.
 */
export const CATEGORIES = [
  'ones',
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'fullHouse',
  'fourOfAKind',
  'littleStraight',
  'bigStraight',
  'choice',
  'yacht',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Twelve turns to a game: one box each (§1). */
export const CATEGORY_COUNT = CATEGORIES.length;

export const isCategory = (value: unknown): value is Category =>
  typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);

/** Five faces, position 0 first. */
export type Dice = readonly number[];

/** One entry per box, in `CATEGORIES` order: the points taken, or null while open. */
export type Scores = readonly (number | null)[];

export type YachtStatus = 'playing' | 'finished';
