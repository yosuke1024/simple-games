/**
 * Board state transitions (docs/MINESWEEPER_RULES.md §2, §3).
 *
 * Pure and immutable: every function returns a new board, or null when the tap
 * changes nothing. There is no undo (§7) — a board is only ever moved forward,
 * and a lost board is replayed from the same seed instead of rewound.
 *
 * The three moves are tap, flag and chord. Chording is the one that can lose a
 * game the player thought was safe: it opens on the strength of the flags, and
 * a wrong flag opens a mine. That is a consequence of the player's own reading
 * of the board, which is why it is allowed to stand (§3).
 */
import { neighbourTable, openRegion, safeCellCount, type MineField } from './board';
import { findSafeCell, type SafeCell, type SolverView } from './solver';
import type { GameStatus } from './types';

export interface Board {
  readonly field: MineField;
  readonly opened: readonly boolean[];
  readonly flagged: readonly boolean[];
  /** The mine that ended the game, or null while it is still running. */
  readonly exploded: number | null;
}

/** What a cell shows — everything the UI and a screen reader need (§12). */
export type CellView =
  | { readonly kind: 'hidden' }
  | { readonly kind: 'flagged' }
  | { readonly kind: 'number'; readonly count: number }
  | { readonly kind: 'mine'; readonly exploded: boolean };

export function createBoard(field: MineField): Board {
  const cells = field.mines.length;
  return {
    field,
    opened: new Array<boolean>(cells).fill(false),
    flagged: new Array<boolean>(cells).fill(false),
    exploded: null,
  };
}

export const cellsOf = (board: Board): number => board.field.mines.length;

/** Won when every cell without a mine is open. Flags are not consulted (§2). */
export function isWon(board: Board): boolean {
  if (board.exploded !== null) return false;
  let open = 0;
  for (const isOpen of board.opened) if (isOpen) open++;
  return open === safeCellCount(board.field);
}

export const isLost = (board: Board): boolean => board.exploded !== null;

export function statusOf(board: Board): GameStatus {
  if (isLost(board)) return 'lost';
  return isWon(board) ? 'won' : 'playing';
}

/** Mines minus flags — board information, not a countdown (§6). Can go negative. */
export function remainingMines(board: Board): number {
  let flags = 0;
  for (const flag of board.flagged) if (flag) flags++;
  let mines = 0;
  for (const mine of board.field.mines) if (mine) mines++;
  return mines - flags;
}

const HIDDEN: CellView = { kind: 'hidden' };
const FLAGGED: CellView = { kind: 'flagged' };

/**
 * What every cell shows, in one pass. A finished game reveals the mines it was
 * hiding, so the player can see the board they were reading rather than guess
 * at what it held.
 */
export function cellViews(board: Board): CellView[] {
  const finished = statusOf(board) !== 'playing';
  const views = new Array<CellView>(cellsOf(board));
  for (let i = 0; i < views.length; i++) {
    if (board.opened[i]) {
      views[i] = board.field.mines[i]
        ? { kind: 'mine', exploded: board.exploded === i }
        : { kind: 'number', count: board.field.counts[i]! };
    } else if (board.flagged[i]) {
      views[i] = FLAGGED;
    } else if (finished && board.field.mines[i]) {
      views[i] = { kind: 'mine', exploded: false };
    } else {
      views[i] = HIDDEN;
    }
  }
  return views;
}

/**
 * Opens one cell into `opened` (which it mutates), ending the game when that
 * cell turns out to hold a mine. Returns the mine that ended it, if any.
 */
function openInto(
  field: MineField,
  index: number,
  opened: boolean[],
  exploded: number | null,
): number | null {
  if (opened[index]) return exploded;
  if (field.mines[index]) {
    opened[index] = true;
    return exploded ?? index;
  }
  openRegion(field, index, opened);
  return exploded;
}

/**
 * Taps a cell open (§3). A 0 opens its whole region and that region's rim; a
 * mine ends the game. Returns null for a flagged cell, an already open cell, or
 * a game that has finished — a flag is a decision the player has to undo on
 * purpose before the cell can be opened.
 */
export function reveal(board: Board, index: number): Board | null {
  if (statusOf(board) !== 'playing') return null;
  if (board.opened[index] || board.flagged[index]) return null;
  const opened = [...board.opened];
  const exploded = openInto(board.field, index, opened, board.exploded);
  return { ...board, opened, exploded };
}

/**
 * Puts a flag down or takes it back (§3). Flags are the player's notes: they
 * are never checked, never corrected, and never part of winning (§2).
 */
export function toggleFlag(board: Board, index: number): Board | null {
  if (statusOf(board) !== 'playing') return null;
  if (board.opened[index]) return null;
  const flagged = [...board.flagged];
  flagged[index] = !flagged[index];
  return { ...board, flagged };
}

/** Whether a chord on this cell would open anything (§3). */
export function canChord(board: Board, index: number): boolean {
  if (statusOf(board) !== 'playing') return false;
  if (!board.opened[index] || board.field.mines[index]) return false;
  const number = board.field.counts[index]!;
  if (number === 0) return false;
  const neighbours = neighbourTable(board.field.width, board.field.height)[index]!;
  let flags = 0;
  let closed = 0;
  for (const neighbour of neighbours) {
    if (board.flagged[neighbour]) flags++;
    else if (!board.opened[neighbour]) closed++;
  }
  return flags === number && closed > 0;
}

/**
 * Opens every unflagged neighbour of an open number whose flags already match
 * it (§3). If one of those flags is wrong, this opens a mine and the game ends
 * — the rules say so plainly, and so does the tutorial.
 */
export function chord(board: Board, index: number): Board | null {
  if (!canChord(board, index)) return null;
  const neighbours = neighbourTable(board.field.width, board.field.height)[index]!;
  const opened = [...board.opened];
  let exploded = board.exploded;
  let changed = false;
  for (const neighbour of neighbours) {
    if (board.flagged[neighbour] || opened[neighbour]) continue;
    exploded = openInto(board.field, neighbour, opened, exploded);
    changed = true;
  }
  return changed ? { ...board, opened, exploded } : null;
}

/** The board as the solver sees it: open numbers only, never the flags (§7). */
export function solverView(board: Board): SolverView {
  const numbers = new Array<number | null>(cellsOf(board));
  for (let i = 0; i < numbers.length; i++) {
    numbers[i] = board.opened[i] && !board.field.mines[i] ? board.field.counts[i]! : null;
  }
  return { width: board.field.width, height: board.field.height, numbers };
}

/**
 * One cell the two rules of §5 prove is safe, with the numbers that prove it.
 * Free and unlimited (§7); it never opens the cell and never points at a mine.
 */
export function findHint(board: Board): SafeCell | null {
  if (statusOf(board) !== 'playing') return null;
  return findSafeCell(solverView(board));
}
