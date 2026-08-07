/**
 * Core FreeCell types. See docs/FREECELL_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A card is one number, 0..51: suit × 13 + (rank − 1), the same encoding
 * Klondike uses. What differs is that FreeCell has no face-down half at all
 * (§1): every card is visible from the deal, so there is no `down`/`up` split
 * to keep honest — a cascade is just the cards in it, bottom first.
 *
 * That also means a cascade is NOT required to be a legal run. The deal drops
 * 52 cards into eight columns in whatever order the shuffle gave, and only the
 * tail of a column is ever a run (§3). `isValidBoard` therefore checks that
 * every card exists exactly once and that the foundations climb their own
 * suit — not that the columns are ordered.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

export const CARD_COUNT = 52;
export const RANKS = 13;
export const CASCADES = 8;
export const FREE_CELLS = 4;

export type Card = number;

export const suitOf = (card: Card): Suit => Math.floor(card / RANKS) as Suit;
/** 1 (ace) .. 13 (king). */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
export const cardOf = (suit: Suit, rank: number): Card => suit * RANKS + (rank - 1);
export const isRed = (card: Card): boolean => {
  const suit = suitOf(card);
  return suit === 1 || suit === 2;
};

export interface FreeCellBoard {
  /** Four single-card cells; null is empty (§1). */
  readonly cells: readonly (Card | null)[];
  /** One pile per suit, ascending from the ace (§3). */
  readonly foundations: readonly (readonly Card[])[];
  /** Eight columns, bottom card first. Only the end is playable (§3). */
  readonly cascades: readonly (readonly Card[])[];
}

export type GameMode = 'free' | 'daily';
export type GameStatus = 'playing' | 'won';

/** Whether `card` may sit on `below` in a cascade: down one, other colour (§3). */
export function stacksOnCascade(card: Card, below: Card): boolean {
  return rankOf(below) === rankOf(card) + 1 && isRed(below) !== isRed(card);
}

/** A sequence that may be carried as one unit: descending, colours alternating. */
export function isValidRun(run: readonly Card[]): boolean {
  for (let i = 1; i < run.length; i++) {
    if (!stacksOnCascade(run[i]!, run[i - 1]!)) return false;
  }
  return true;
}

/**
 * A board that could have come from a deal and legal play: every card exactly
 * once, and each foundation ascending in its own suit from the ace.
 *
 * Column order is deliberately not checked — see the note at the top of this
 * file. A freshly dealt column is almost never a run.
 */
export function isValidBoard(board: FreeCellBoard): boolean {
  if (board.cells.length !== FREE_CELLS) return false;
  if (board.foundations.length !== SUITS.length) return false;
  if (board.cascades.length !== CASCADES) return false;

  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  const see = (card: Card): boolean => {
    if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT || seen[card]) return false;
    seen[card] = true;
    return true;
  };

  for (const cell of board.cells) {
    if (cell === null) continue;
    if (!see(cell)) return false;
  }
  for (const suit of SUITS) {
    const pile = board.foundations[suit]!;
    for (let i = 0; i < pile.length; i++) {
      const card = pile[i]!;
      if (!see(card)) return false;
      if (suitOf(card) !== suit || rankOf(card) !== i + 1) return false;
    }
  }
  for (const cascade of board.cascades) {
    for (const card of cascade) if (!see(card)) return false;
  }
  return seen.every(Boolean);
}
