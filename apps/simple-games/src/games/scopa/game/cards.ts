/**
 * The forty-card deck, as numbers (docs/SCOPA_RULES.md §1). Copied in shape
 * from Hearts / Gin Rummy rather than shared, so a game stays independent of
 * every other (docs/ARCHITECTURE.md — `games/A` never imports `games/B`).
 *
 * A card is one number, 0..39: suit × 10 + (value − 1). Nothing else is stored
 * about it — no face-up flag, no owner — so a card can never disagree with the
 * pile holding it. The suits are drawn French (♠ ♥ ♦ ♣) and ♦ stands for the
 * Italian coins, so 7♦ is the card that carries a scoring category of its own.
 *
 * The value is the whole of the capture arithmetic: ace 1, two to seven at
 * face value, jack 8, queen 9, king 10. There are no eights, nines or tens.
 * Hearts holds the ace high and Gin Rummy holds it low; here it is simply the
 * value 1 — the three titles do not agree about the ace, on purpose.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs — the same order as Hearts / Gin Rummy. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];
export const DIAMONDS: Suit = 2;

export const CARD_COUNT = 40;
/** Values per suit: A, 2–7, J, Q, K. */
export const VALUES = 10;
/** The highest value a capture can sum to (a king). */
export const MAX_VALUE = 10;

export type Card = number;

export const suitOf = (card: Card): Suit => Math.floor(card / VALUES) as Suit;
/** 1 (ace) .. 7 at face value, then 8 (J), 9 (Q), 10 (K). */
export const valueOf = (card: Card): number => (card % VALUES) + 1;
export const cardOf = (suit: Suit, value: number): Card => suit * VALUES + (value - 1);

/** 7♦ — `2 × 10 + 6`. */
export const SEVEN_OF_DIAMONDS: Card = cardOf(DIAMONDS, 7);

export const isDiamond = (card: Card): boolean => suitOf(card) === DIAMONDS;

/** Whether `value` is a card number at all — the guard every decoder starts at. */
export const isCard = (value: unknown): value is Card =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CARD_COUNT;

/**
 * The primiera table (§1, §3.3), by value 1..10: 7 → 21, 6 → 18, A → 16,
 * 5 → 15, 4 → 14, 3 → 13, 2 → 12, J / Q / K → 10. This is the only place the
 * table lives.
 */
const PRIMIERA_BY_VALUE: readonly number[] = [0, 16, 12, 13, 14, 15, 18, 21, 10, 10, 10];

export const primieraValueOf = (card: Card): number => PRIMIERA_BY_VALUE[valueOf(card)]!;

/** The face as printed on the card: ASCII in every language (§1). */
const FACES: readonly string[] = ['', 'A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'];
export const faceOf = (card: Card): string => FACES[valueOf(card)]!;

/** Ascending by card number — suit first, then value. The canonical order. */
export const sortedCards = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => a - b);

/** The forty cards in ascending order — what every deal shuffles afresh (§2.1). */
export const FULL_DECK: readonly Card[] = Array.from({ length: CARD_COUNT }, (_, card) => card);
