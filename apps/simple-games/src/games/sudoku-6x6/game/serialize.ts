/**
 * The saved board, as §11 of docs/SUDOKU_6X6_RULES.md writes it:
 *
 * givens:   36 characters, '1'..'6' for a clue, '.' elsewhere.
 * solution: 36 characters, '1'..'6'.
 * entries:  36 characters, '1'..'6' for a player digit, '.' elsewhere.
 * notes:    36 integers, each a 6-bit mask (0..63).
 *
 * The solution travels with the save: recomputing it would mean running the
 * solver before the first frame of a resume, and 36 characters is cheaper.
 *
 * Decoding is fail-closed (§11): a record only becomes a board if play could
 * have produced it. Anything else returns null and the caller falls back to
 * "no game to resume" rather than to a broken board.
 */
import type { Board } from './engine';
import { gridFromString, gridToString } from './generator';
import { isGridSolved } from './solver';
import { ALL_CANDIDATES, CELLS, type Grid } from './types';

export interface EncodedBoards {
  readonly givens: string;
  readonly solution: string;
  readonly entries: string;
  readonly notes: readonly number[];
}

export function encodeBoards(board: Board, solution: Grid): EncodedBoards {
  return {
    givens: gridToString(board.givens),
    solution: gridToString(solution),
    entries: gridToString(board.entries),
    notes: [...board.notes],
  };
}

/** Decodes a persisted board and its answer. Null when anything does not add up (§11). */
export function decodeBoards(encoded: EncodedBoards): { board: Board; solution: Grid } | null {
  const givens = gridFromString(encoded.givens);
  const solution = gridFromString(encoded.solution);
  const entries = gridFromString(encoded.entries);
  if (givens === null || solution === null || entries === null) return null;
  // The answer must itself keep §2: six of each digit, no repeat anywhere.
  if (!isGridSolved(solution)) return null;
  if (!Array.isArray(encoded.notes) || encoded.notes.length !== CELLS) return null;

  const notes: number[] = [];
  for (let i = 0; i < CELLS; i++) {
    const mask = encoded.notes[i];
    if (typeof mask !== 'number' || !Number.isInteger(mask)) return null;
    if (mask < 0 || mask > ALL_CANDIDATES) return null;
    const given = givens[i]!;
    const entry = entries[i]!;
    // A clue that disagrees with the answer, or an entry written over a clue,
    // cannot come out of play.
    if (given !== 0 && given !== solution[i]) return null;
    if (given !== 0 && entry !== 0) return null;
    // Placing a digit clears the cell's notes (§3), so a filled cell with
    // notes is not a state the game makes.
    if ((given !== 0 || entry !== 0) && mask !== 0) return null;
    notes.push(mask);
  }

  return { board: { givens, entries, notes }, solution };
}
