/**
 * The hint (docs/SPIDER_SOLITAIRE_RULES.md §8): one sound legal move, by a
 * fixed order of preference.
 *
 * NOT A SOLVER. It reads the board as it stands and offers the move a decent
 * player would look at first. It does not search ahead, it does not promise
 * the deal can be won, and following it forever is not a strategy.
 *
 * Spider earns a hint where FreeCell does not, and for one reason: this board
 * has face-down cards on it. There is information the player genuinely cannot
 * see, so pointing at a move that would uncover some is lifting a veil rather
 * than taking the decision.
 *
 * Two things it deliberately never suggests:
 *  - Sliding a run sideways when nothing is uncovered and no run grows. Those
 *    moves are legal, reversible, and endless — a hint that offered them could
 *    walk a player in a circle all afternoon.
 *  - Breaking a same-suit run that is already tidy.
 */
import { canDeal, canPlaceOnColumn, columnTop, movableRunStart } from './engine';
import { COLUMNS, rankOf, suitOf, type SpiderBoard } from './types';

export type HintMove =
  | { readonly kind: 'move'; readonly from: number; readonly index: number; readonly to: number }
  | { readonly kind: 'deal' };

interface Candidate {
  readonly from: number;
  readonly index: number;
  readonly to: number;
  /** Lower is better. */
  readonly tier: number;
  /** Within a tier, longer runs first. */
  readonly length: number;
}

/**
 * Whether moving the run at `index` of `from` would turn a face-down card
 * over — the move that actually opens a Spider board up.
 */
function uncovers(board: SpiderBoard, from: number, index: number): boolean {
  const pile = board.tableau[from]!;
  return index === 0 && pile.down.length > 0;
}

/** Whether the run would land on a card of its own suit, extending it. */
function joinsSuit(board: SpiderBoard, head: number, to: number): boolean {
  const top = columnTop(board, to);
  if (top === null) return false;
  return suitOf(top, board.suitCount) === suitOf(head, board.suitCount);
}

export function findHint(board: SpiderBoard): HintMove | null {
  const candidates: Candidate[] = [];

  for (let from = 0; from < COLUMNS; from++) {
    const pile = board.tableau[from]!;
    if (pile.up.length === 0) continue;
    const start = movableRunStart(board, from);

    for (let index = start; index < pile.up.length; index++) {
      const head = pile.up[index]!;
      const run = pile.up.slice(index);
      for (let to = 0; to < COLUMNS; to++) {
        if (to === from) continue;
        if (!canPlaceOnColumn(board, head, to)) continue;

        const opensUp = uncovers(board, from, index);
        const sameSuit = joinsSuit(board, head, to);
        const intoEmpty = board.tableau[to]!.up.length === 0;
        // Moving only part of a tidy run splits it — never worth suggesting.
        const splitsRun = index > start;
        // Clearing a column outright is worth doing: an empty column is where
        // the next run gets built, and it is what the stock waits on (§3).
        // Not into another empty column, though — that just moves the hole.
        const emptiesSource = index === 0 && pile.down.length === 0;

        let tier: number;
        if (opensUp && sameSuit) tier = 0;
        else if (opensUp) tier = 1;
        else if (sameSuit && !splitsRun) tier = 2;
        else if (emptiesSource && !intoEmpty) tier = 3;
        // Everything else is a sideways shuffle: legal, but it uncovers
        // nothing, grows nothing and clears nothing, so the hint stays quiet
        // about it. Offering those could walk a player in a circle all
        // afternoon — every one of them is reversible.
        else continue;

        candidates.push({ from, index, to, tier, length: run.length });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.tier - b.tier || b.length - a.length || a.from - b.from);
    const best = candidates[0]!;
    return { kind: 'move', from: best.from, index: best.index, to: best.to };
  }

  return canDeal(board) ? { kind: 'deal' } : null;
}

/** Whether any legal move at all remains — used to tell a dead board (§2). */
export function hasAnyMove(board: SpiderBoard): boolean {
  if (canDeal(board)) return true;
  for (let from = 0; from < COLUMNS; from++) {
    const pile = board.tableau[from]!;
    if (pile.up.length === 0) continue;
    for (let index = movableRunStart(board, from); index < pile.up.length; index++) {
      const head = pile.up[index]!;
      for (let to = 0; to < COLUMNS; to++) {
        if (to === from) continue;
        // Moving a whole column into an empty one changes nothing.
        if (
          index === 0 &&
          pile.down.length === 0 &&
          board.tableau[to]!.up.length === 0 &&
          board.tableau[to]!.down.length === 0
        ) {
          continue;
        }
        if (canPlaceOnColumn(board, head, to)) return true;
      }
    }
  }
  return false;
}

/** Exposed for the rules doc's sake: the rank a column would accept next. */
export const accepts = (board: SpiderBoard, to: number): number | null => {
  const top = columnTop(board, to);
  return top === null ? null : rankOf(top) - 1;
};
