/**
 * Core Solitaire (Klondike) types. See docs/SOLITAIRE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A card is one number, 0..51: suit × 13 + (rank − 1). Zones hold card
 * numbers; "face up" is positional (a tableau pile's `up` half), never a flag
 * on the card — so a card can never disagree with the pile holding it.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

export const CARD_COUNT = 52;
export const RANKS = 13;
export const TABLEAU_PILES = 7;

export type Card = number;

export const suitOf = (card: Card): Suit => Math.floor(card / RANKS) as Suit;
/** 1 (ace) .. 13 (king). */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
export const cardOf = (suit: Suit, rank: number): Card => suit * RANKS + (rank - 1);
export const isRed = (card: Card): boolean => {
  const suit = suitOf(card);
  return suit === 1 || suit === 2;
};

/** A tableau pile: hidden cards below, the face-up run on top (§1). */
export interface Pile {
  readonly down: readonly Card[];
  /** Bottom-to-top; always a legal descending, color-alternating run (§3). */
  readonly up: readonly Card[];
}

export interface SolitaireBoard {
  /** Face down; the end of the array is the top. */
  readonly stock: readonly Card[];
  /** Face up; only the end of the array is playable (§1). */
  readonly waste: readonly Card[];
  /** One pile per suit, ascending from the ace (§3). */
  readonly foundations: readonly (readonly Card[])[];
  readonly tableau: readonly Pile[];
}

export type GameMode = 'free' | 'daily';
export type GameStatus = 'playing' | 'won';

/** Whether `card` may sit on `below` in a tableau run (§3). */
export function stacksOnTableau(card: Card, below: Card): boolean {
  return rankOf(below) === rankOf(card) + 1 && isRed(below) !== isRed(card);
}

/** A face-up sequence that could exist in play: descending, colors alternating. */
export function isValidRun(run: readonly Card[]): boolean {
  for (let i = 1; i < run.length; i++) {
    if (!stacksOnTableau(run[i]!, run[i - 1]!)) return false;
  }
  return true;
}

/**
 * A board that could have come from a deal and legal play: every card exactly
 * once, foundations ascending in their own suit, tableau runs legal, and no
 * pile showing a face-down top while face-up cards were available to flip.
 */
export function isValidBoard(board: SolitaireBoard): boolean {
  if (board.foundations.length !== SUITS.length) return false;
  if (board.tableau.length !== TABLEAU_PILES) return false;

  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  const see = (card: Card): boolean => {
    if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT || seen[card]) return false;
    seen[card] = true;
    return true;
  };

  for (const card of board.stock) if (!see(card)) return false;
  for (const card of board.waste) if (!see(card)) return false;
  for (const suit of SUITS) {
    const pile = board.foundations[suit]!;
    for (let i = 0; i < pile.length; i++) {
      const card = pile[i]!;
      if (!see(card)) return false;
      if (suitOf(card) !== suit || rankOf(card) !== i + 1) return false;
    }
  }
  for (const pile of board.tableau) {
    for (const card of pile.down) if (!see(card)) return false;
    for (const card of pile.up) if (!see(card)) return false;
    if (!isValidRun(pile.up)) return false;
    // A hidden card under an empty run means a missed flip — never from play.
    if (pile.up.length === 0 && pile.down.length > 0) return false;
  }
  return seen.every(Boolean);
}
