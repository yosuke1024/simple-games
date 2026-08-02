/**
 * The deal (docs/SOLITAIRE_RULES.md §1, §5): shuffle 52 cards by seed, lay
 * seven piles of 1..7 with the top card face up, and the rest is the stock.
 *
 * Everything derives from the seed, so a date — or a retried deal — is the
 * same game on every device. Deals are not screened for winnability (§5):
 * proving a Klondike deal winnable is a full search that has no place in a
 * phone's tap-to-play budget, and an unprovable promise must not be made.
 */
import { createRng, shuffled } from './rng';
import { CARD_COUNT, SUITS, TABLEAU_PILES, type Pile, type SolitaireBoard } from './types';

export function dealBoard(seed: string): SolitaireBoard {
  const rng = createRng(seed);
  const deck: number[] = [];
  for (let card = 0; card < CARD_COUNT; card++) deck.push(card);
  const dealt = shuffled(deck, rng);

  let cursor = 0;
  const tableau: Pile[] = [];
  for (let pileIndex = 0; pileIndex < TABLEAU_PILES; pileIndex++) {
    const cards = dealt.slice(cursor, cursor + pileIndex + 1);
    cursor += pileIndex + 1;
    tableau.push({ down: cards.slice(0, -1), up: cards.slice(-1) });
  }

  return {
    stock: dealt.slice(cursor),
    waste: [],
    foundations: SUITS.map(() => []),
    tableau,
  };
}

/** Board string form for golden tests: zones joined by '/', piles by '.'. */
export function boardToString(board: SolitaireBoard): string {
  const cards = (list: readonly number[]): string =>
    list.map((card) => card.toString(36).padStart(2, '0')).join('');
  return [
    cards(board.stock),
    cards(board.waste),
    board.foundations.map(cards).join('.'),
    board.tableau.map((pile) => `${cards(pile.down)}!${cards(pile.up)}`).join('.'),
  ].join('/');
}
