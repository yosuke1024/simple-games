/**
 * The deal (docs/SPIDER_SOLITAIRE_RULES.md §1, §5): shuffle 52 cards by seed,
 * deal 1..7 cards across seven columns, with only each top card face up.
 * The remaining 24 are the stock: three rows of seven, then three cards (§3).
 *
 * The shuffle does not know the difficulty. Card numbers are unique and their
 * suits are read off the difficulty later (types.ts), so the same seed puts
 * the same cards in the same places at one, two or four suits; only what they
 * read as changes. One daily deal serves all three.
 *
 * Deals are not screened for winnability (§5). At four suits an unwinnable
 * deal is a real possibility, and no solver runs here to rule it out.
 */
import { createRng, shuffled } from './rng';
import {
  CARD_COUNT,
  COLUMNS,
  type Card,
  type Pile,
  type SpiderBoard,
  type SuitCount,
} from './types';

/** Cards laid on the table at the start; the rest is stock. */
const DEALT = (COLUMNS * (COLUMNS + 1)) / 2;

export function dealBoard(seed: string, suitCount: SuitCount): SpiderBoard {
  const rng = createRng(seed);
  const deck: number[] = [];
  for (let card = 0; card < CARD_COUNT; card++) deck.push(card);
  const dealt = shuffled(deck, rng);

  const columns: Card[][] = Array.from({ length: COLUMNS }, () => []);
  // Klondike-style triangular deal: one card in column 1, two in column 2,
  // and so on. Only the final card in each column is exposed.
  let next = 0;
  for (let row = 0; row < COLUMNS; row++) {
    for (let column = row; column < COLUMNS; column++) {
      columns[column]!.push(dealt[next++]!);
    }
  }

  const tableau: Pile[] = columns.map((cards) => ({
    down: cards.slice(0, -1),
    up: cards.slice(-1),
  }));

  return {
    suitCount,
    stock: dealt.slice(DEALT),
    tableau,
    completed: [],
  };
}

/** Board string form for golden tests: zones joined by '/', piles by '.'. */
export function boardToString(board: SpiderBoard): string {
  const cards = (list: readonly number[]): string =>
    list.map((card) => card.toString(36).padStart(2, '0')).join('');
  return [
    String(board.suitCount),
    cards(board.stock),
    board.completed.map(cards).join('.'),
    board.tableau.map((pile) => `${cards(pile.down)}!${cards(pile.up)}`).join('.'),
  ].join('/');
}
