/**
 * Core Spider Solitaire types. See docs/SPIDER_SOLITAIRE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * Spiderette uses 52 unique card IDs (0..51). Rank is card % 13 + 1;
 * copy is floor(card / 13), 0..3. At one suit every copy is spades,
 * at two suits copy % 2 gives spades/hearts, and at four suits copy % 4
 * gives all four. Difficulty changes suits, never the seeded layout.
 */

/** 0 spades, 1 hearts, 2 diamonds, 3 clubs — the same numbering the other card games use. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

/** How many suits are in play (§ difficulty). One is the gentlest. */
export type SuitCount = 1 | 2 | 4;
export const SUIT_COUNTS: readonly SuitCount[] = [1, 2, 4];

export const CARD_COUNT = 52;
export const RANKS = 13;
export const COLUMNS = 7;
/** Four complete king-to-ace runs win Spiderette (§2). */
export const RUNS_TO_WIN = 4;
export const INITIAL_STOCK = 24;
/** Three full rows, then three cards to the leftmost columns (§3). */
export const STOCK_DEALS = 4;

export type Card = number;

/** 1 (ace) .. 13 (king). */
export const rankOf = (card: Card): number => (card % RANKS) + 1;
/** Which of the four thirteens this card belongs to, 0..3. */
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
  /** Face down, dealt up to seven at a time from the end (§3). */
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

/** Reachable stocks: 24 → 17 → 10 → 3 → 0 (§3). */
export const isValidStockSize = (count: number): boolean =>
  Number.isInteger(count) &&
  count >= 0 &&
  count <= INITIAL_STOCK &&
  (count === 0 || (INITIAL_STOCK - count) % COLUMNS === 0);

/**
 * A board that could have come from a deal and legal play: every one of the
 * cards exactly once, the requested columns and a reachable stock size, no column
 * showing a face-down top under an empty face-up part, and every completed pile
 * a real king-to-ace run.
 */
export function validateBoardShape(
  board: SpiderBoard,
  cardCount: number,
  columns: number,
  validStockSize: (count: number) => boolean,
): boolean {
  if (board.tableau.length !== columns) return false;
  if (board.completed.length > cardCount / RANKS) return false;
  if (board.suitCount !== 1 && board.suitCount !== 2 && board.suitCount !== 4) return false;
  if (!validStockSize(board.stock.length)) return false;

  const seen = new Array<boolean>(cardCount).fill(false);
  const see = (card: Card): boolean => {
    if (!Number.isInteger(card) || card < 0 || card >= cardCount || seen[card]) return false;
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

export const isValidBoard = (board: SpiderBoard): boolean =>
  validateBoardShape(board, CARD_COUNT, COLUMNS, isValidStockSize);
