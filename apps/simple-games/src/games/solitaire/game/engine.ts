/**
 * Board state transitions (docs/SOLITAIRE_RULES.md §3, §7).
 *
 * Pure and immutable: every move returns a new board, or null when it is not
 * legal — in which case nothing changes. Flipping an exposed hidden card is
 * part of the move that exposed it (§3), so no board this module returns ever
 * shows a face-down top with an empty run.
 */
import {
  rankOf,
  stacksOnTableau,
  suitOf,
  type Card,
  type Pile,
  type SolitaireBoard,
} from './types';

const KING = 13;

/** The playable waste card, or null. */
export const wasteTop = (board: SolitaireBoard): Card | null =>
  board.waste.length === 0 ? null : board.waste[board.waste.length - 1]!;

/** Turns the next hidden card whenever a pile's run has been emptied (§3). */
function normalized(pile: Pile): Pile {
  if (pile.up.length > 0 || pile.down.length === 0) return pile;
  return { down: pile.down.slice(0, -1), up: pile.down.slice(-1) };
}

const withTableau = (board: SolitaireBoard, index: number, pile: Pile): SolitaireBoard => ({
  ...board,
  tableau: board.tableau.map((current, i) => (i === index ? normalized(pile) : current)),
});

/** Whether `card` may start a run on tableau pile `to` (§3). */
export function canPlaceOnTableau(board: SolitaireBoard, card: Card, to: number): boolean {
  const pile = board.tableau[to];
  if (!pile) return false;
  if (pile.up.length === 0) return pile.down.length === 0 && rankOf(card) === KING;
  return stacksOnTableau(card, pile.up[pile.up.length - 1]!);
}

/** Whether `card` is the next card its suit's foundation needs (§3). */
export function canPlaceOnFoundation(board: SolitaireBoard, card: Card): boolean {
  return board.foundations[suitOf(card)]!.length === rankOf(card) - 1;
}

/**
 * Draws from the stock (§3): up to `count` cards flip to the waste, top of
 * the stock first. On an empty stock the waste turns back over whole — the
 * unlimited redeal (§3, §13).
 */
export function draw(board: SolitaireBoard, count: number): SolitaireBoard | null {
  if (board.stock.length > 0) {
    const taken = Math.min(count, board.stock.length);
    const moving = board.stock.slice(board.stock.length - taken).reverse();
    return {
      ...board,
      stock: board.stock.slice(0, board.stock.length - taken),
      waste: [...board.waste, ...moving],
    };
  }
  if (board.waste.length === 0) return null;
  return { ...board, stock: [...board.waste].reverse(), waste: [] };
}

/** Moves the face-up run starting at `index` of pile `from` onto `to` (§3). */
export function moveTableauRun(
  board: SolitaireBoard,
  from: number,
  index: number,
  to: number,
): SolitaireBoard | null {
  if (from === to) return null;
  const source = board.tableau[from];
  if (!source || index < 0 || index >= source.up.length) return null;
  const run = source.up.slice(index);
  if (!canPlaceOnTableau(board, run[0]!, to)) return null;

  const dest = board.tableau[to]!;
  const next = withTableau(board, from, { down: source.down, up: source.up.slice(0, index) });
  return withTableau(next, to, { down: dest.down, up: [...dest.up, ...run] });
}

/** Sends a tableau pile's top card to its foundation (§3). */
export function moveTableauToFoundation(
  board: SolitaireBoard,
  from: number,
): SolitaireBoard | null {
  const source = board.tableau[from];
  if (!source || source.up.length === 0) return null;
  const card = source.up[source.up.length - 1]!;
  if (!canPlaceOnFoundation(board, card)) return null;

  const next = withTableau(board, from, { down: source.down, up: source.up.slice(0, -1) });
  return {
    ...next,
    foundations: next.foundations.map((pile, suit) =>
      suit === suitOf(card) ? [...pile, card] : pile,
    ),
  };
}

/** Plays the waste's top card onto a tableau pile (§3). */
export function moveWasteToTableau(board: SolitaireBoard, to: number): SolitaireBoard | null {
  const card = wasteTop(board);
  if (card === null || !canPlaceOnTableau(board, card, to)) return null;
  const dest = board.tableau[to]!;
  const next: SolitaireBoard = { ...board, waste: board.waste.slice(0, -1) };
  return withTableau(next, to, { down: dest.down, up: [...dest.up, card] });
}

/** Sends the waste's top card to its foundation (§3). */
export function moveWasteToFoundation(board: SolitaireBoard): SolitaireBoard | null {
  const card = wasteTop(board);
  if (card === null || !canPlaceOnFoundation(board, card)) return null;
  return {
    ...board,
    waste: board.waste.slice(0, -1),
    foundations: board.foundations.map((pile, suit) =>
      suit === suitOf(card) ? [...pile, card] : pile,
    ),
  };
}

/** Takes a foundation's top card back to the tableau — legal, rarely wise (§3). */
export function moveFoundationToTableau(
  board: SolitaireBoard,
  suit: number,
  to: number,
): SolitaireBoard | null {
  const pile = board.foundations[suit];
  if (!pile || pile.length === 0) return null;
  const card = pile[pile.length - 1]!;
  if (!canPlaceOnTableau(board, card, to)) return null;
  const dest = board.tableau[to]!;
  const next: SolitaireBoard = {
    ...board,
    foundations: board.foundations.map((current, i) =>
      i === suit ? current.slice(0, -1) : current,
    ),
  };
  return withTableau(next, to, { down: dest.down, up: [...dest.up, card] });
}

/** All four suits complete (§2). */
export function isWon(board: SolitaireBoard): boolean {
  return board.foundations.every((pile) => pile.length === 13);
}

/**
 * Nothing hidden and nothing in hand: the rest is bookkeeping the player
 * should not have to do by hand (§7).
 */
export function canAutoFinish(board: SolitaireBoard): boolean {
  return (
    !isWon(board) &&
    board.stock.length === 0 &&
    board.waste.length === 0 &&
    board.tableau.every((pile) => pile.down.length === 0)
  );
}

export interface AutoFinishResult {
  readonly board: SolitaireBoard;
  /** Cards moved — each is a move, because it happened (§7). */
  readonly moved: number;
}

/**
 * Runs the endgame (§7): with every card face up in legal runs, repeatedly
 * playing any available next card to its foundation always finishes.
 */
export function autoFinish(board: SolitaireBoard): AutoFinishResult | null {
  if (!canAutoFinish(board)) return null;
  let current = board;
  let moved = 0;
  // 52 cards is the absolute ceiling; the guard only keeps this total.
  for (let step = 0; step < 64 && !isWon(current); step++) {
    let progressed = false;
    for (let pile = 0; pile < current.tableau.length; pile++) {
      const next = moveTableauToFoundation(current, pile);
      if (next) {
        current = next;
        moved++;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return isWon(current) ? { board: current, moved } : null;
}
