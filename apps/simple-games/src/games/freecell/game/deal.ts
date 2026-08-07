/**
 * The deal (docs/FREECELL_RULES.md §1, §5): shuffle 52 cards by seed and lay
 * them left to right across eight columns, so the first four hold seven cards
 * and the last four hold six. Cells and foundations start empty, and every
 * card is face up from the first moment.
 *
 * Everything derives from the seed, so a date — or a retried deal — is the
 * same game on every device.
 *
 * Deals are not screened for winnability (§5). Unlike Klondike, nearly every
 * FreeCell deal is winnable in principle, but "nearly" is the honest word: no
 * solver runs here, no promise is made, and a deal that cannot be won can
 * still come up.
 */
import { createRng, shuffled } from './rng';
import { CARD_COUNT, CASCADES, FREE_CELLS, SUITS, type Card, type FreeCellBoard } from './types';

export function dealBoard(seed: string): FreeCellBoard {
  const rng = createRng(seed);
  const deck: number[] = [];
  for (let card = 0; card < CARD_COUNT; card++) deck.push(card);
  const dealt = shuffled(deck, rng);

  const cascades: Card[][] = Array.from({ length: CASCADES }, () => []);
  dealt.forEach((card, index) => cascades[index % CASCADES]!.push(card));

  return {
    cells: Array.from({ length: FREE_CELLS }, () => null),
    foundations: SUITS.map(() => []),
    cascades,
  };
}

/** Board string form for golden tests: zones joined by '/', piles by '.'. */
export function boardToString(board: FreeCellBoard): string {
  const cards = (list: readonly number[]): string =>
    list.map((card) => card.toString(36).padStart(2, '0')).join('');
  return [
    board.cells
      .map((cell) => (cell === null ? '--' : cell.toString(36).padStart(2, '0')))
      .join('.'),
    board.foundations.map(cards).join('.'),
    board.cascades.map(cards).join('.'),
  ].join('/');
}
