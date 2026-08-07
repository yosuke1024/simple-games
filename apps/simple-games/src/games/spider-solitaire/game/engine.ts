/**
 * Board state transitions (docs/SPIDER_SOLITAIRE_RULES.md §2, §3).
 *
 * Pure and immutable: every move returns a new board, or null when it is not
 * legal — in which case nothing changes.
 *
 * Two things happen automatically as part of the move that caused them, never
 * as a move of their own (§4): an exposed face-down card turns over, and a
 * finished king-to-ace run leaves the table. Both are folded in here, so no
 * board this module returns ever shows a face-down top under an empty column,
 * or a complete run still sitting in one.
 */
import {
  COLUMNS,
  isCompleteRun,
  isMovableRun,
  isValidStockSize,
  RANKS,
  rankOf,
  suitOf,
  type Card,
  type Pile,
  type SpiderBoard,
} from './types';

/** The playable card of a column, or null when the column is empty. */
export const columnTop = (board: SpiderBoard, index: number): Card | null => {
  const pile = board.tableau[index];
  if (!pile || pile.up.length === 0) return null;
  return pile.up[pile.up.length - 1]!;
};

/** Turns the next hidden card whenever a column's face-up part has emptied (§3). */
function normalized(pile: Pile): Pile {
  if (pile.up.length > 0 || pile.down.length === 0) return pile;
  return { down: pile.down.slice(0, -1), up: pile.down.slice(-1) };
}

/**
 * Takes every finished king-to-ace run off the table, turning over whatever
 * each one uncovers. Part of the move that completed it, so it costs nothing
 * of its own (§4). Loops because one deal can finish more than one run.
 */
function harvested(board: SpiderBoard): SpiderBoard {
  let current = board;
  for (let pass = 0; pass < COLUMNS; pass++) {
    let found = -1;
    for (let index = 0; index < current.tableau.length; index++) {
      const up = current.tableau[index]!.up;
      if (up.length < RANKS) continue;
      if (isCompleteRun(up.slice(up.length - RANKS), current.suitCount)) {
        found = index;
        break;
      }
    }
    if (found === -1) return current;
    const pile = current.tableau[found]!;
    const run = pile.up.slice(pile.up.length - RANKS);
    current = {
      ...current,
      completed: [...current.completed, run],
      tableau: current.tableau.map((p, i) =>
        i === found ? normalized({ down: p.down, up: p.up.slice(0, p.up.length - RANKS) }) : p,
      ),
    };
  }
  return current;
}

const withTableau = (board: SpiderBoard, index: number, pile: Pile): SpiderBoard => ({
  ...board,
  tableau: board.tableau.map((current, i) => (i === index ? normalized(pile) : current)),
});

/** Whether `card` may be placed on column `to` (§3). An empty column takes any card. */
export function canPlaceOnColumn(board: SpiderBoard, card: Card, to: number): boolean {
  const pile = board.tableau[to];
  if (!pile) return false;
  if (pile.up.length === 0) return pile.down.length === 0;
  return rankOf(pile.up[pile.up.length - 1]!) === rankOf(card) + 1;
}

/**
 * The lowest index of a column's face-up part whose tail is still one suit
 * descending — the deepest card a player may pick up there (§3).
 */
export function movableRunStart(board: SpiderBoard, from: number): number {
  const pile = board.tableau[from];
  if (!pile || pile.up.length === 0) return 0;
  const up = pile.up;
  let index = up.length - 1;
  while (
    index > 0 &&
    rankOf(up[index - 1]!) === rankOf(up[index]!) + 1 &&
    suitOf(up[index - 1]!, board.suitCount) === suitOf(up[index]!, board.suitCount)
  ) {
    index--;
  }
  return index;
}

/**
 * Moves the run starting at `index` of column `from` onto column `to` (§3).
 * There is no carrying capacity here as there is in FreeCell: a same-suit run
 * moves whole, however long, because Spider's difficulty is in building one at
 * all rather than in having somewhere to put it down.
 */
export function moveRun(
  board: SpiderBoard,
  from: number,
  index: number,
  to: number,
): SpiderBoard | null {
  if (from === to) return null;
  const source = board.tableau[from];
  if (!source || index < 0 || index >= source.up.length) return null;
  const run = source.up.slice(index);
  if (!isMovableRun(run, board.suitCount)) return null;
  if (!canPlaceOnColumn(board, run[0]!, to)) return null;

  const dest = board.tableau[to]!;
  const next = withTableau(board, from, { down: source.down, up: source.up.slice(0, index) });
  return harvested(withTableau(next, to, { down: dest.down, up: [...dest.up, ...run] }));
}

/**
 * Whether the stock may be dealt (§3). The classic rule: not while any column
 * stands empty. It stops a player from burying the one thing that would have
 * dug them out, and it is the reason an empty column is worth holding.
 */
export function canDeal(board: SpiderBoard): boolean {
  // A stock that is not whole rows cannot have come from a deal (types.ts).
  // The saved-game validator already refuses one, and this refuses it again:
  // a board that reached the engine anyway must not be made worse by dealing
  // short rows from it, and fifteen would otherwise deal ten and leave five.
  if (!isValidStockSize(board.stock.length)) return false;
  if (board.stock.length === 0) return false;
  return board.tableau.every((pile) => pile.up.length > 0 || pile.down.length > 0);
}

/** Deals one card face up to every column (§3). */
export function dealRow(board: SpiderBoard): SpiderBoard | null {
  if (!canDeal(board)) return null;
  const taken = board.stock.slice(board.stock.length - COLUMNS);
  const next: SpiderBoard = {
    ...board,
    stock: board.stock.slice(0, board.stock.length - COLUMNS),
    tableau: board.tableau.map((pile, i) => ({ down: pile.down, up: [...pile.up, taken[i]!] })),
  };
  return harvested(next);
}

/** How many deals are left in the stock — what the player actually counts (§3). */
export const dealsLeft = (board: SpiderBoard): number => Math.floor(board.stock.length / COLUMNS);

/** All eight runs finished (§2). */
export function isWon(board: SpiderBoard): boolean {
  return board.completed.length >= 8;
}
