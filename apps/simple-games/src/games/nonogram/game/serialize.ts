/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/NONOGRAM_RULES.md §10).
 *
 * One character per cell, row-major: the solution uses '0' / '1', the player's
 * marks '0' / '1' / '2' (unknown / painted / crossed). A whole 10×10 board is
 * therefore 100 characters.
 *
 * Decoding fails closed: a wrong length or a stray character marks the record
 * corrupt, and the caller falls back to a fresh board rather than a broken one.
 */
import {
  CROSSED,
  EMPTY,
  FILLED,
  PAINTED,
  UNKNOWN,
  cellCount,
  type Cell,
  type Mark,
  type Size,
} from './types';

export function encodeCells(cells: readonly number[]): string {
  return cells.join('');
}

/** Decodes a persisted solution. Returns null when anything does not add up. */
export function decodeSolution(text: string, size: Size): Cell[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const cells: Cell[] = [];
  for (const character of text) {
    if (character === '0') cells.push(EMPTY);
    else if (character === '1') cells.push(PAINTED);
    else return null;
  }
  return cells;
}

/** Decodes persisted marks. Returns null when anything does not add up. */
export function decodeMarks(text: string, size: Size): Mark[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const marks: Mark[] = [];
  for (const character of text) {
    if (character === '0') marks.push(UNKNOWN);
    else if (character === '1') marks.push(FILLED);
    else if (character === '2') marks.push(CROSSED);
    else return null;
  }
  return marks;
}
