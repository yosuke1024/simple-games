/**
 * The deck, as numbers. Copied from the patience shelf (Solitaire / FreeCell /
 * Spider) rather than shared, so a game stays independent of every other
 * (docs/ARCHITECTURE.md).
 *
 * A card is one number, 0..51: suit × 13 + (rank − 1). Nothing else is stored
 * about it — no face-up flag, no owner — so a card can never disagree with the
 * pile holding it.
 *
 * What this copy adds over the patience ones is the **price list**. Hearts is
 * a game about two kinds of card: the thirteen hearts, worth a point apiece,
 * and the queen of spades, worth thirteen on her own. Everything else is worth
 * nothing and exists only to lose tricks with. `penaltyPointsOf` is the single
 * place that table lives; every score in the game is a sum of it.
 *
 * The ace is **high** here, unlike the Gin Rummy copy: a trick is taken by the
 * highest card of the suit led, and the ace of a suit always takes it. Rank 1
 * is the two — rank 13 is the ace — which is why the constructors below take a
 * rank from 1 to 13 and `rankOf` returns the same, with no wrap-around
 * anywhere.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Suit = 0 | 1 | 2 | 3;
export const SPADES: Suit = 0;
export const HEARTS: Suit = 1;
export const DIAMONDS: Suit = 2;
export const CLUBS: Suit = 3;
export const SUITS: readonly Suit[] = [SPADES, HEARTS, DIAMONDS, CLUBS];

export const CARD_COUNT = 52;
export const RANKS = 13;

export type Card = number;

export const suitOf = (card: Card): Suit => Math.floor(card / RANKS) as Suit;
/**
 * 1 (two) .. 13 (ace). Hearts has no low ace and no sequences, so this is a
 * pure ordering: the bigger number takes the trick.
 */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
export const cardOf = (suit: Suit, rank: number): Card => suit * RANKS + (rank - 1);
export const isRed = (card: Card): boolean => {
  const suit = suitOf(card);
  return suit === HEARTS || suit === DIAMONDS;
};

/** Whether `value` is a card number at all — the guard every decoder starts at. */
export const isCard = (value: unknown): value is Card =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CARD_COUNT;

/**
 * Rank 1 is the two and rank 11 the queen, so the two cards the rules single
 * out can be written down once instead of spelled as arithmetic wherever they
 * are needed.
 */
export const RANK_TWO = 1;
export const RANK_QUEEN = 11;
export const RANK_KING = 12;
export const RANK_ACE = 13;

export const TWO_OF_CLUBS: Card = cardOf(CLUBS, RANK_TWO);
export const QUEEN_OF_SPADES: Card = cardOf(SPADES, RANK_QUEEN);

export const isHeart = (card: Card): boolean => suitOf(card) === HEARTS;

/** A heart is a point; the queen of spades is thirteen. */
export const HEART_PENALTY = 1;
export const QUEEN_PENALTY = 13;

/**
 * What a card costs the seat that takes it in. Zero for every card that is
 * neither a heart nor the queen — which is thirty-eight of the fifty-two, and
 * the reason most tricks are free.
 */
export const penaltyPointsOf = (card: Card): number => {
  if (card === QUEEN_OF_SPADES) return QUEEN_PENALTY;
  return isHeart(card) ? HEART_PENALTY : 0;
};

/** Total penalty value of a set of cards, in points. */
export function penaltyTotal(cards: readonly Card[]): number {
  let total = 0;
  for (const card of cards) total += penaltyPointsOf(card);
  return total;
}

/** Ascending by card number — suit first, then rank. The canonical order. */
export const sortedCards = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => a - b);

/** Whether the cards are in canonical order with no card twice. */
export function isAscending(cards: readonly Card[]): boolean {
  for (let at = 1; at < cards.length; at++) {
    if (cards[at]! <= cards[at - 1]!) return false;
  }
  return true;
}

/** How many of the cards are of the given suit. */
export function countSuit(cards: readonly Card[], suit: Suit): number {
  let count = 0;
  for (const card of cards) if (suitOf(card) === suit) count += 1;
  return count;
}
