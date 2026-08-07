/**
 * Core Spider Solitaire types. See docs/SPIDER_SOLITAIRE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * THE CARD ENCODING IS THE ONE THING TO READ BEFORE CHANGING ANYTHING HERE.
 *
 * Spider is played with two decks, so the naive encoding the other card games
 * use — suit × 13 + (rank − 1), 0..51 — would put two identical numbers on the
 * table. That breaks two things at once: `isValidBoard` could no longer tell
 * "every card exactly once" from "one card twice and another missing", and the
 * table's move animation, which finds a card again by its number after the
 * board has changed, would animate one of the pair to the other's seat.
 *
 * So a card here is a unique 0..103:
 *
 *   rank = card % 13 + 1        1 (ace) .. 13 (king)
 *   copy = Math.floor(card / 13)   0..7 — which of the eight thirteens it is
 *
 * and the SUIT IS DERIVED FROM THE DIFFICULTY, not stored:
 *
 *   1 suit  → every card is a spade
 *   2 suits → copy % 2          spades and hearts
 *   4 suits → copy % 4          all four
 *
 * The deal shuffles 104 numbers once, so the same seed lays the same cards in
 * the same places at every difficulty — only what suit they read as changes.
 * That is what lets the daily be one deal rather than three, and what lets the
 * golden test pin the shuffle and the suit mapping separately.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs — the same numbering the other card games use. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

/** How many suits are in play (§ difficulty). One is the gentlest. */
export type SuitCount = 1 | 2 | 4;
export const SUIT_COUNTS: readonly SuitCount[] = [1, 2, 4];

export const CARD_COUNT = 104;
export const RANKS = 13;
export const COLUMNS = 10;
/** Eight complete king-to-ace runs win the game (§2). */
export const RUNS_TO_WIN = 8;
/** Ten cards per deal, five deals (§3). */
export const STOCK_DEALS = 5;

export type Card = number;

/** 1 (ace) .. 13 (king). */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
/** Which of the eight thirteens this card belongs to, 0..7. */
export const copyOf = (card: Card): number => Math.floor(card / RANKS);

/** The suit this card reads as at the given difficulty (see the note above). */
export const suitOf = (card: Card, suitCount: SuitCount): Suit =>
  (suitCount === 1 ? 0 : copyOf(card) % suitCount) as Suit;

export const isRed = (card: Card, suitCount: SuitCount): boolean => {
  const suit = suitOf(card, suitCount);
  return suit === 1 || suit === 2;
};

/** The card of a given suit and rank, in the first copy that reads that way. */
export const cardOf = (suit: Suit, rank: number, suitCount: SuitCount): Card => {
  const copy = suitCount === 1 ? 0 : suit % suitCount;
  return copy * RANKS + (rank - 1);
};

/** A tableau column: hidden cards below, the face-up part on top (§1). */
export interface Pile {
  readonly down: readonly Card[];
  /**
   * Bottom-to-top. Unlike Klondike this is NOT always a legal run: cards land
   * on any rank one higher, whatever the suit, so a column's face-up part is
   * usually a stack of short same-suit runs (§3).
   */
  readonly up: readonly Card[];
}

export interface SpiderBoard {
  readonly suitCount: SuitCount;
  /** Face down, dealt ten at a time from the end (§3). */
  readonly stock: readonly Card[];
  readonly tableau: readonly Pile[];
  /** Finished king-to-ace runs, each still holding its thirteen cards (§2). */
  readonly completed: readonly (readonly Card[])[];
}

export type GameMode = 'free' | 'daily';
export type GameStatus = 'playing' | 'won';

/** Whether `card` may sit on `below`: one rank lower, any suit (§3). */
export function stacksOnColumn(card: Card, below: Card): boolean {
  return rankOf(below) === rankOf(card) + 1;
}

/**
 * A sequence that may be carried as one unit: descending AND all one suit
 * (§3). This is the rule that makes Spider what it is — cards land loosely,
 * but only a tidy run travels.
 */
export function isMovableRun(run: readonly Card[], suitCount: SuitCount): boolean {
  for (let i = 1; i < run.length; i++) {
    const above = run[i]!;
    const below = run[i - 1]!;
    if (rankOf(below) !== rankOf(above) + 1) return false;
    if (suitOf(below, suitCount) !== suitOf(above, suitCount)) return false;
  }
  return true;
}

/** Whether a thirteen-card run is a complete king-to-ace suit (§2). */
export function isCompleteRun(run: readonly Card[], suitCount: SuitCount): boolean {
  return run.length === RANKS && rankOf(run[0]!) === RANKS && isMovableRun(run, suitCount);
}

/**
 * A board that could have come from a deal and legal play: every one of the
 * 104 cards exactly once, ten columns, no column showing a face-down top under
 * an empty face-up part, and every completed pile a real king-to-ace run.
 */
export function isValidBoard(board: SpiderBoard): boolean {
  if (board.tableau.length !== COLUMNS) return false;
  if (board.completed.length > RUNS_TO_WIN) return false;
  if (board.suitCount !== 1 && board.suitCount !== 2 && board.suitCount !== 4) return false;

  const seen = new Array<boolean>(CARD_COUNT).fill(false);
  const see = (card: Card): boolean => {
    if (!Number.isInteger(card) || card < 0 || card >= CARD_COUNT || seen[card]) return false;
    seen[card] = true;
    return true;
  };

  for (const card of board.stock) if (!see(card)) return false;
  for (const run of board.completed) {
    for (const card of run) if (!see(card)) return false;
    if (!isCompleteRun(run, board.suitCount)) return false;
  }
  for (const pile of board.tableau) {
    for (const card of pile.down) if (!see(card)) return false;
    for (const card of pile.up) if (!see(card)) return false;
    // A hidden card under an empty face-up part means a missed flip.
    if (pile.up.length === 0 && pile.down.length > 0) return false;
  }
  return seen.every(Boolean);
}
