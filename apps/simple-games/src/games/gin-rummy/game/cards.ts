/**
 * The deck, as numbers. Copied from the patience shelf (Solitaire / FreeCell /
 * Spider) rather than shared, so a game stays independent of every other
 * (docs/ARCHITECTURE.md).
 *
 * A card is one number, 0..51: suit × 13 + (rank − 1). Nothing else is stored
 * about it — no face-up flag, no owner — so a card can never disagree with the
 * pile holding it.
 *
 * The one thing this file adds over the patience copies is `deadwoodValueOf`:
 * Gin Rummy prices a card rather than only ordering it (ace 1, pips at face
 * value, court cards 10). Rank order still matters — runs are built on it —
 * and the ace is **low only**: A-2-3 is a run, Q-K-A is not, which is why no
 * function here ever wraps rank 13 round to rank 1.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

export const CARD_COUNT = 52;
export const RANKS = 13;

export type Card = number;

export const suitOf = (card: Card): Suit => Math.floor(card / RANKS) as Suit;
/** 1 (ace) .. 13 (king). The ace is low and never high. */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
export const cardOf = (suit: Suit, rank: number): Card => suit * RANKS + (rank - 1);
export const isRed = (card: Card): boolean => {
  const suit = suitOf(card);
  return suit === 1 || suit === 2;
};

/** Whether `value` is a card number at all — the guard every decoder starts at. */
export const isCard = (value: unknown): value is Card =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CARD_COUNT;

/**
 * What a card costs when it is left out of a meld: ace 1, two through ten at
 * face value, jack / queen / king 10 apiece. This is the only place the
 * scoring table lives; deadwood, the knock limit and every settlement are
 * sums of it.
 */
export const deadwoodValueOf = (card: Card): number => Math.min(rankOf(card), 10);

/** Total deadwood value of a set of cards, in points. */
export function deadwoodTotal(cards: readonly Card[]): number {
  let total = 0;
  for (const card of cards) total += deadwoodValueOf(card);
  return total;
}

/** Ascending by card number — suit first, then rank. The canonical order. */
export const sortedCards = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => a - b);
