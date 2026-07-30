/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/SUDOKU_RULES.md §11).
 *
 * givens/entries: one character per cell, '0' for empty, '1'..'9' for a digit.
 * notes:          the note mask per cell in base 32, comma-separated — a mask
 *                 is 9 bits, so '0'..'ff' and never wider than two characters.
 *
 * The solution is stored too. It is recomputable from the givens, but a resume
 * that had to re-run the solver would either block the first frame or need an
 * async path through the whole session; 81 characters is the cheaper trade.
 * Decoding fails closed: anything malformed returns null and the caller falls
 * back to "no game to resume" rather than to a broken board.
 */
import { CELLS, type Grid } from './types';
import type { Board } from './engine';

export interface EncodedBoard {
  readonly givens: string;
  readonly entries: string;
  readonly notes: string;
}

const encodeGrid = (grid: Grid): string => {
  let out = '';
  for (let i = 0; i < CELLS; i++) out += String(grid[i] ?? 0);
  return out;
};

const decodeGrid = (text: string): Grid | null => {
  if (text.length !== CELLS) return null;
  const grid: number[] = [];
  for (const character of text) {
    const value = Number(character);
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
    grid.push(value);
  }
  return grid;
};

export function encodeBoard(board: Board): EncodedBoard {
  return {
    givens: encodeGrid(board.givens),
    entries: encodeGrid(board.entries),
    notes: board.notes.map((mask) => mask.toString(32)).join(','),
  };
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(encoded: EncodedBoard): Board | null {
  const givens = decodeGrid(encoded.givens);
  const entries = decodeGrid(encoded.entries);
  if (givens === null || entries === null) return null;

  const parts = encoded.notes === '' ? [] : encoded.notes.split(',');
  if (parts.length !== CELLS) return null;
  const notes: number[] = [];
  for (const part of parts) {
    const mask = parseInt(part, 32);
    if (!Number.isInteger(mask) || mask < 0 || mask > 0b111111111) return null;
    notes.push(mask);
  }

  // A clue cell must not also carry an entry: that state cannot be produced by
  // play, so a record holding it is corrupt rather than merely odd.
  for (let i = 0; i < CELLS; i++) {
    if (givens[i] !== 0 && entries[i] !== 0) return null;
  }

  return { givens, entries, notes };
}

export function encodeSolution(solution: Grid): string {
  return encodeGrid(solution);
}

/** Decodes a stored solution. Returns null unless it is 81 filled digits. */
export function decodeSolution(text: string): Grid | null {
  const grid = decodeGrid(text);
  if (grid === null) return null;
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0) return null;
  return grid;
}
