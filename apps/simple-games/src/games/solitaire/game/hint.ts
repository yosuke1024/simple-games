/**
 * The Hint (docs/SOLITAIRE_RULES.md §8): one legal move, picked by the
 * classic priorities — free a hidden card, build a foundation, play from the
 * waste, and otherwise draw.
 *
 * This is deliberately NOT a solver. Proving a Klondike line wins is a full
 * search with no place in a tap's budget (§5), so the hint promises only "a
 * sound legal move now", and the rules document says so in as many words. It
 * never suggests shuffling runs between piles when nothing flips (that can
 * cycle forever), and never suggests taking a card back off a foundation.
 */
import {
  canPlaceOnFoundation,
  canPlaceOnTableau,
  wasteTop,
} from './engine';
import type { SolitaireBoard } from './types';

export type HintMove =
  | { readonly kind: 'tableau'; readonly from: number; readonly index: number; readonly to: number }
  | { readonly kind: 'tableau-foundation'; readonly from: number }
  | { readonly kind: 'waste-tableau'; readonly to: number }
  | { readonly kind: 'waste-foundation' }
  | { readonly kind: 'draw' };

export function findHint(board: SolitaireBoard): HintMove | null {
  // 1. A run move that turns a hidden card over — strict progress (§8).
  for (let from = 0; from < board.tableau.length; from++) {
    const pile = board.tableau[from]!;
    if (pile.up.length === 0 || pile.down.length === 0) continue;
    const head = pile.up[0]!;
    for (let to = 0; to < board.tableau.length; to++) {
      if (to !== from && canPlaceOnTableau(board, head, to)) {
        return { kind: 'tableau', from, index: 0, to };
      }
    }
  }

  // 2. A card the foundations are waiting for.
  for (let from = 0; from < board.tableau.length; from++) {
    const pile = board.tableau[from]!;
    const top = pile.up[pile.up.length - 1];
    if (top !== undefined && canPlaceOnFoundation(board, top)) {
      return { kind: 'tableau-foundation', from };
    }
  }
  const waste = wasteTop(board);
  if (waste !== null && canPlaceOnFoundation(board, waste)) {
    return { kind: 'waste-foundation' };
  }

  // 3. Bring the waste into play.
  if (waste !== null) {
    for (let to = 0; to < board.tableau.length; to++) {
      if (canPlaceOnTableau(board, waste, to)) return { kind: 'waste-tableau', to };
    }
  }

  // 4. Otherwise: draw (or turn the waste back over). Always available while
  // any card remains in hand.
  if (board.stock.length > 0 || board.waste.length > 0) return { kind: 'draw' };

  return null;
}
