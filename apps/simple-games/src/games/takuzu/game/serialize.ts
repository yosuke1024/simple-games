/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/TAKUZU_RULES.md §11).
 *
 * One character per cell, row-major: '0' and '1' are the digits themselves and
 * '.' is a cell with nothing in it. A whole 10×10 board is therefore 100
 * characters, and a saved game is three of them — solution, givens, marks.
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A record only survives if it is a record play could have produced:
 * the solution obeys all three rules, every given matches the solution under
 * it, and no mark sits on a given. A save that fails any of those did not come
 * from this game, and the caller drops it for a fresh board rather than
 * handing the player a puzzle with no answer.
 */
import { isSolved } from './engine';
import { EMPTY, ONE, ZERO, cellCount, type Cell, type Mark, type Size } from './types';

const EMPTY_CHARACTER = '.';

/** Encodes a solution, a givens board or a marks board — all three are cells. */
export function encodeBoard(cells: readonly Mark[]): string {
  return cells.map((cell) => (cell === EMPTY ? EMPTY_CHARACTER : String(cell))).join('');
}

function decodeCells(text: unknown, size: Size): Mark[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const cells: Mark[] = [];
  for (const character of text) {
    if (character === '0') cells.push(ZERO);
    else if (character === '1') cells.push(ONE);
    else if (character === EMPTY_CHARACTER) cells.push(EMPTY);
    else return null;
  }
  return cells;
}

/**
 * Decodes a persisted solution. Null unless it is a finished board that keeps
 * all three rules — the one invariant everything else in the save leans on.
 */
export function decodeSolution(text: unknown, size: Size): Cell[] | null {
  const cells = decodeCells(text, size);
  if (cells === null || !isSolved(cells, size)) return null;
  return cells as Cell[];
}

/** Decodes persisted givens. Null when any of them disagrees with the solution. */
export function decodeGivens(text: unknown, size: Size, solution: readonly Cell[]): Mark[] | null {
  const cells = decodeCells(text, size);
  if (cells === null) return null;
  const consistent = cells.every((cell, index) => cell === EMPTY || cell === solution[index]);
  return consistent ? cells : null;
}

/** Decodes persisted marks. Null when one of them sits on a given (§11). */
export function decodeMarks(text: unknown, size: Size, givens: readonly Mark[]): Mark[] | null {
  const cells = decodeCells(text, size);
  if (cells === null) return null;
  const clear = cells.every((cell, index) => cell === EMPTY || givens[index] === EMPTY);
  return clear ? cells : null;
}

export interface DecodedBoards {
  readonly solution: Cell[];
  readonly givens: Mark[];
  readonly marks: Mark[];
}

/**
 * The three boards of one saved game, checked against each other. Null when
 * any single part fails, so a caller has one call to make and one thing to
 * check rather than an order of operations to get right.
 */
export function decodeBoards(
  parts: { solution: unknown; givens: unknown; marks: unknown },
  size: Size,
): DecodedBoards | null {
  const solution = decodeSolution(parts.solution, size);
  if (solution === null) return null;
  const givens = decodeGivens(parts.givens, size, solution);
  if (givens === null) return null;
  const marks = decodeMarks(parts.marks, size, givens);
  return marks === null ? null : { solution, givens, marks };
}
