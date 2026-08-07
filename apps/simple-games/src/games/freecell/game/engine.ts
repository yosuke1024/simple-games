/**
 * Board state transitions (docs/FREECELL_RULES.md §3, §7).
 *
 * Pure and immutable: every move returns a new board, or null when it is not
 * legal — in which case nothing changes.
 *
 * Nothing is ever hidden here, so there is no flip to fold into a move the way
 * Klondike does. What FreeCell has instead is the supermove: carrying several
 * cards at once is shorthand for a sequence of single-card moves through the
 * free cells and empty columns, so the engine checks that the shorthand could
 * have been spelled out before it allows it (§3).
 *
 * A card is never taken back off a foundation (§13). The classic rule set does
 * not allow it, and the reason it exists elsewhere — undoing a card sent too
 * early — is served here by Undo, which is free and unlimited (§8).
 */
import {
  CASCADES,
  isValidRun,
  rankOf,
  stacksOnCascade,
  suitOf,
  type Card,
  type FreeCellBoard,
} from './types';

/** The playable card of cascade `index`, or null when the column is empty. */
export const cascadeTop = (board: FreeCellBoard, index: number): Card | null => {
  const cascade = board.cascades[index];
  if (!cascade || cascade.length === 0) return null;
  return cascade[cascade.length - 1]!;
};

/** Whether `card` may be placed on cascade `to` (§3). An empty column takes any card. */
export function canPlaceOnCascade(board: FreeCellBoard, card: Card, to: number): boolean {
  const cascade = board.cascades[to];
  if (!cascade) return false;
  if (cascade.length === 0) return true;
  return stacksOnCascade(card, cascade[cascade.length - 1]!);
}

/** Whether `card` is the next card its suit's foundation needs (§3). */
export function canPlaceOnFoundation(board: FreeCellBoard, card: Card): boolean {
  return board.foundations[suitOf(card)]!.length === rankOf(card) - 1;
}

export const freeCellCount = (board: FreeCellBoard): number =>
  board.cells.filter((cell) => cell === null).length;

export const emptyCascadeCount = (board: FreeCellBoard): number =>
  board.cascades.filter((cascade) => cascade.length === 0).length;

/**
 * How many cards may be carried in one move onto `to` (§3):
 * `(1 + free cells) × 2^(empty columns)`.
 *
 * An empty destination does not count itself. The doubling comes from parking
 * a part-run in an empty column and picking it back up, and the column you are
 * moving into is filled by the move — so it cannot also be the staging area.
 * Getting this wrong in the permissive direction would let a player make a
 * move they could not have made by hand.
 */
export function maxMoveSize(board: FreeCellBoard, to: number): number {
  const destinationIsEmpty = (board.cascades[to]?.length ?? 0) === 0;
  const staging = emptyCascadeCount(board) - (destinationIsEmpty ? 1 : 0);
  return (1 + freeCellCount(board)) * 2 ** staging;
}

/**
 * The lowest index of cascade `from` whose tail is still a legal run — the
 * deepest card a player is allowed to pick up there, capacity aside.
 */
export function movableRunStart(board: FreeCellBoard, from: number): number {
  const cascade = board.cascades[from];
  if (!cascade || cascade.length === 0) return 0;
  let index = cascade.length - 1;
  while (index > 0 && stacksOnCascade(cascade[index]!, cascade[index - 1]!)) index--;
  return index;
}

const withCascades = (
  board: FreeCellBoard,
  changes: readonly (readonly [number, readonly Card[]])[],
): FreeCellBoard => ({
  ...board,
  cascades: board.cascades.map((cascade, i) => {
    const change = changes.find(([index]) => index === i);
    return change ? change[1] : cascade;
  }),
});

const withFoundation = (board: FreeCellBoard, card: Card): FreeCellBoard['foundations'] =>
  board.foundations.map((pile, suit) => (suit === suitOf(card) ? [...pile, card] : pile));

/**
 * Parks a cascade's top card in a free cell (§3). Names the cell when the
 * player picked one — the four are interchangeable to the rules, but not to
 * someone who just tapped a particular one — and takes the first empty cell
 * otherwise.
 */
export function moveCascadeToCell(
  board: FreeCellBoard,
  from: number,
  toCell?: number,
): FreeCellBoard | null {
  const card = cascadeTop(board, from);
  if (card === null) return null;
  const cell = toCell === undefined ? board.cells.indexOf(null) : toCell;
  if (cell < 0 || cell >= board.cells.length || board.cells[cell] !== null) return null;
  return {
    ...withCascades(board, [[from, board.cascades[from]!.slice(0, -1)]]),
    cells: board.cells.map((current, i) => (i === cell ? card : current)),
  };
}

/** Sends a cascade's top card to its foundation (§3). */
export function moveCascadeToFoundation(board: FreeCellBoard, from: number): FreeCellBoard | null {
  const card = cascadeTop(board, from);
  if (card === null || !canPlaceOnFoundation(board, card)) return null;
  return {
    ...withCascades(board, [[from, board.cascades[from]!.slice(0, -1)]]),
    foundations: withFoundation(board, card),
  };
}

/** Plays a cell's card onto a cascade (§3). */
export function moveCellToCascade(
  board: FreeCellBoard,
  cell: number,
  to: number,
): FreeCellBoard | null {
  const card = board.cells[cell];
  if (card === null || card === undefined) return null;
  if (!canPlaceOnCascade(board, card, to)) return null;
  return {
    ...withCascades(board, [[to, [...board.cascades[to]!, card]]]),
    cells: board.cells.map((current, i) => (i === cell ? null : current)),
  };
}

/** Sends a cell's card to its foundation (§3). */
export function moveCellToFoundation(board: FreeCellBoard, cell: number): FreeCellBoard | null {
  const card = board.cells[cell];
  if (card === null || card === undefined) return null;
  if (!canPlaceOnFoundation(board, card)) return null;
  return {
    ...board,
    cells: board.cells.map((current, i) => (i === cell ? null : current)),
    foundations: withFoundation(board, card),
  };
}

/**
 * Moves the run starting at `index` of cascade `from` onto cascade `to` (§3).
 * One move, however many cards it carries (§4).
 */
export function moveCascadeRun(
  board: FreeCellBoard,
  from: number,
  index: number,
  to: number,
): FreeCellBoard | null {
  if (from === to) return null;
  const source = board.cascades[from];
  if (!source || index < 0 || index >= source.length) return null;
  const run = source.slice(index);
  if (!isValidRun(run)) return null;
  if (!canPlaceOnCascade(board, run[0]!, to)) return null;
  if (run.length > maxMoveSize(board, to)) return null;
  return withCascades(board, [
    [from, source.slice(0, index)],
    [to, [...board.cascades[to]!, ...run]],
  ]);
}

/** All four suits complete (§2). */
export function isWon(board: FreeCellBoard): boolean {
  return board.foundations.every((pile) => pile.length === 13);
}

/**
 * Whether any legal move remains (§2). FreeCell can be played into a dead end
 * with cards still on the table — every cell full and nothing that fits — and
 * unlike Klondike there is no stock to turn, so nothing will loosen it. The
 * game says so plainly rather than leaving the player to work it out.
 *
 * Deliberately exhaustive, and deliberately conservative: it enumerates every
 * shape of legal move, so it can only ever fail by finding a move, never by
 * calling a live board dead.
 */
export function hasAnyMove(board: FreeCellBoard): boolean {
  for (let cell = 0; cell < board.cells.length; cell++) {
    const card = board.cells[cell];
    if (card === null || card === undefined) continue;
    if (canPlaceOnFoundation(board, card)) return true;
    for (let to = 0; to < CASCADES; to++) {
      if (canPlaceOnCascade(board, card, to)) return true;
    }
  }

  const cellFree = freeCellCount(board) > 0;
  for (let from = 0; from < CASCADES; from++) {
    const cascade = board.cascades[from]!;
    if (cascade.length === 0) continue;
    if (cellFree) return true;
    if (canPlaceOnFoundation(board, cascade[cascade.length - 1]!)) return true;
    for (let index = movableRunStart(board, from); index < cascade.length; index++) {
      for (let to = 0; to < CASCADES; to++) {
        if (to === from) continue;
        if (moveCascadeRun(board, from, index, to)) return true;
      }
    }
  }
  return false;
}

export interface AutoFinishResult {
  readonly board: FreeCellBoard;
  /** Cards moved — each is a move, because it happened (§7). */
  readonly moved: number;
}

/**
 * Plays every card that can go to a foundation, over and over, and reports
 * where that leaves the board. Sending a card to a foundation never blocks
 * another one — foundations only grow, and a send only uncovers more — so the
 * greedy order is as good as any: if foundation moves alone can finish this
 * board, this finds it.
 */
function greedyToFoundations(board: FreeCellBoard): AutoFinishResult {
  let current = board;
  let moved = 0;
  for (let step = 0; step < 52 && !isWon(current); step++) {
    let progressed = false;
    for (let cell = 0; cell < current.cells.length && !progressed; cell++) {
      const next = moveCellToFoundation(current, cell);
      if (next) {
        current = next;
        moved++;
        progressed = true;
      }
    }
    for (let pile = 0; pile < CASCADES && !progressed; pile++) {
      const next = moveCascadeToFoundation(current, pile);
      if (next) {
        current = next;
        moved++;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return { board: current, moved };
}

/**
 * Whether the rest is bookkeeping (§7): the board is already decided, and
 * every remaining card can walk to its foundation unaided.
 */
export function canAutoFinish(board: FreeCellBoard): boolean {
  if (isWon(board)) return false;
  return isWon(greedyToFoundations(board).board);
}

/** Runs the endgame (§7), or null when the board is not yet decided. */
export function autoFinish(board: FreeCellBoard): AutoFinishResult | null {
  if (isWon(board)) return null;
  const result = greedyToFoundations(board);
  return isWon(result.board) ? result : null;
}
