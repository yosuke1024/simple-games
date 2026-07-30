/**
 * Board state transitions (docs/SUDOKU_RULES.md §3, §4).
 *
 * Pure and immutable: every function returns a new board or null when the move
 * is not allowed. Notes are candidate masks the player owns; placing a digit
 * clears them from the cell and from the peers that can no longer hold it,
 * which is the bookkeeping a person would otherwise do by hand.
 *
 * A mistake is a digit that disagrees with the puzzle's one solution. It is
 * counted, never punished: there is no mistake limit and no game over (§4).
 */
import {
  ALL_UNITS,
  bitOf,
  CELLS,
  hasBit,
  PEERS,
  type Digit,
  type Grid,
  type Puzzle,
} from './types';

export interface Board {
  /** The clues, 0 elsewhere. Never changes during a game. */
  readonly givens: Grid;
  /** What the player has entered, 0 for empty. Clue cells stay 0 here. */
  readonly entries: Grid;
  /** Note masks per cell (bit 0 = digit 1). */
  readonly notes: readonly number[];
}

export function createBoard(givens: Grid): Board {
  return {
    givens,
    entries: new Array<number>(CELLS).fill(0),
    notes: new Array<number>(CELLS).fill(0),
  };
}

export const isGiven = (board: Board, index: number): boolean => board.givens[index] !== 0;

/** The digit shown in a cell — a clue, the player's entry, or 0. */
export const valueAt = (board: Board, index: number): number =>
  board.givens[index] !== 0 ? board.givens[index]! : board.entries[index]!;

/** The board as one grid, for the solver and the grader. */
export function toGrid(board: Board): Grid {
  const grid = new Array<number>(CELLS);
  for (let i = 0; i < CELLS; i++) grid[i] = valueAt(board, i);
  return grid;
}

export function isComplete(board: Board): boolean {
  for (let i = 0; i < CELLS; i++) if (valueAt(board, i) === 0) return false;
  return true;
}

/** How many of a digit are on the board — the pad shows 9 minus this (§3). */
export function digitCount(board: Board, digit: Digit): number {
  let count = 0;
  for (let i = 0; i < CELLS; i++) if (valueAt(board, i) === digit) count++;
  return count;
}

/**
 * Cells that break a row/column/box rule as the board stands. Always shown,
 * independent of the mistake setting: this is the rule, not the answer (§4).
 */
export function conflictingCells(board: Board): ReadonlySet<number> {
  const conflicts = new Set<number>();
  for (const unit of ALL_UNITS) {
    const seen = new Map<number, number[]>();
    for (const cell of unit.cells) {
      const value = valueAt(board, cell);
      if (value === 0) continue;
      const cells = seen.get(value);
      if (cells) cells.push(cell);
      else seen.set(value, [cell]);
    }
    for (const cells of seen.values()) {
      if (cells.length > 1) for (const cell of cells) conflicts.add(cell);
    }
  }
  return conflicts;
}

/** Player entries that disagree with the solution (§4). */
export function mistakenCells(board: Board, solution: Grid): ReadonlySet<number> {
  const wrong = new Set<number>();
  for (let i = 0; i < CELLS; i++) {
    const entry = board.entries[i]!;
    if (entry !== 0 && entry !== solution[i]) wrong.add(i);
  }
  return wrong;
}

export interface PlaceResult {
  readonly board: Board;
  /** True when the digit disagrees with the solution — counted, not punished. */
  readonly mistake: boolean;
}

/**
 * Writes a digit into an empty or already-filled player cell. Returns null for
 * a clue cell or a no-op (the same digit already there).
 */
export function place(board: Board, index: number, digit: Digit, solution: Grid): PlaceResult | null {
  if (isGiven(board, index)) return null;
  if (board.entries[index] === digit) return null;

  const entries = [...board.entries];
  entries[index] = digit;

  // The cell's own notes go: it holds a digit now.
  const notes = [...board.notes];
  notes[index] = 0;
  // Peers can no longer hold this digit, so the note goes too (§3).
  const remove = ~bitOf(digit);
  for (const peer of PEERS[index]!) {
    if (notes[peer]! !== 0) notes[peer] = notes[peer]! & remove;
  }

  return {
    board: { ...board, entries, notes },
    mistake: solution[index] !== digit,
  };
}

/** Clears a player entry. Returns null for a clue cell or an empty cell. */
export function erase(board: Board, index: number): Board | null {
  if (isGiven(board, index)) return null;
  if (board.entries[index] === 0 && board.notes[index] === 0) return null;
  const entries = [...board.entries];
  const notes = [...board.notes];
  entries[index] = 0;
  notes[index] = 0;
  return { ...board, entries, notes };
}

/**
 * Adds or removes one note digit. Returns null for a clue cell or a cell that
 * already holds an entry (a note there would contradict what is shown).
 */
export function toggleNote(board: Board, index: number, digit: Digit): Board | null {
  if (isGiven(board, index)) return null;
  if (board.entries[index] !== 0) return null;
  const notes = [...board.notes];
  notes[index] = notes[index]! ^ bitOf(digit);
  return { ...board, notes };
}

export function hasNote(board: Board, index: number, digit: Digit): boolean {
  return hasBit(board.notes[index]!, digit);
}

/** Solved: every cell filled and nothing repeated (§2). */
export function isSolved(board: Board): boolean {
  for (let i = 0; i < CELLS; i++) if (valueAt(board, i) === 0) return false;
  return conflictingCells(board).size === 0;
}

/** Fills the notes of every empty cell with the digits its peers allow. */
export function fillNotes(board: Board): Board {
  const notes = [...board.notes];
  for (let i = 0; i < CELLS; i++) {
    if (valueAt(board, i) !== 0) {
      notes[i] = 0;
      continue;
    }
    let mask = 0b111111111;
    for (const peer of PEERS[i]!) {
      const value = valueAt(board, peer);
      if (value !== 0) mask &= ~bitOf(value);
    }
    notes[i] = mask;
  }
  return { ...board, notes };
}

/** A fresh board for a generated puzzle. */
export const boardForPuzzle = (puzzle: Puzzle): Board => createBoard(puzzle.givens);
