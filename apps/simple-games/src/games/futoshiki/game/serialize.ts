/**
 * Compact, corruption-tolerant serialization for local persistence
 * (docs/FUTOSHIKI_RULES.md §11).
 *
 * Three shapes travel:
 * - a grid: one character per cell, row-major, '1'..'7' for a digit and '.'
 *   for a cell with nothing in it. A whole 7×7 board is 49 characters, and a
 *   saved game holds three of them — solution, givens, entries.
 * - the signs: one token per sign, `<cell><h|v><'<'|'>'>`, comma-separated.
 *   The cell is the upper-left of the pair and the letter says which gap it
 *   sits in, so `12h<` reads "cell 12 is less than the cell to its right".
 *   Storing the pair rather than a picture of the board keeps the record the
 *   same shape at every size.
 * - the notes: one mask per cell in base 32, comma-separated, the same form
 *   Sudoku uses. Seven digits is seven bits, so a mask is never wider than two
 *   characters.
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A record only survives if it is a record play could have produced:
 * the solution is a Latin square, every sign is a real gap that the solution
 * satisfies, every given matches the solution under it, no entry sits on a
 * given, and no note sits on a filled cell. A save that fails any of those did
 * not come from this game, and the caller drops it for a fresh board rather
 * than handing the player a puzzle with no answer.
 */
import { isSolved, type Board } from './engine';
import {
  EMPTY,
  allCandidates,
  cellCount,
  colOf,
  constraintAxis,
  constraintCells,
  rowOf,
  type Constraint,
  type Grid,
  type Size,
} from './types';

const EMPTY_CHARACTER = '.';

/** Encodes a solution, a givens grid or an entries grid — all three are grids. */
export function encodeGrid(cells: Grid): string {
  return cells.map((cell) => (cell === EMPTY ? EMPTY_CHARACTER : String(cell))).join('');
}

function decodeGrid(text: unknown, size: Size): number[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(size)) return null;
  const cells: number[] = [];
  for (const character of text) {
    if (character === EMPTY_CHARACTER) {
      cells.push(EMPTY);
      continue;
    }
    const value = Number(character);
    if (!Number.isInteger(value) || value < 1 || value > size) return null;
    cells.push(value);
  }
  return cells;
}

/**
 * Decodes a persisted solution. Null unless it is a full Latin square — the
 * one invariant everything else in the save leans on. The signs are checked
 * against it separately, so this call answers only "is this an answer at all".
 */
export function decodeSolution(text: unknown, size: Size): number[] | null {
  const cells = decodeGrid(text, size);
  if (cells === null || !isSolved(cells, size, [])) return null;
  return cells;
}

export function encodeConstraints(constraints: readonly Constraint[], size: Size): string {
  return constraints
    .map((constraint) => {
      const [first] = constraintCells(constraint);
      const gap = constraintAxis(constraint, size) === 'row' ? 'h' : 'v';
      return `${first}${gap}${constraint.less === first ? '<' : '>'}`;
    })
    .join(',');
}

const TOKEN = /^(\d{1,2})([hv])([<>])$/;

/**
 * Decodes the sign list. Null when a token is malformed, names a gap that does
 * not exist at this size, repeats a gap, or points against the solution.
 *
 * The empty list is refused too: a board with no signs is a Latin square
 * puzzle, not a Futoshiki (§14), and no level or daily produces one.
 */
export function decodeConstraints(text: unknown, size: Size, solution: Grid): Constraint[] | null {
  if (typeof text !== 'string' || text === '') return null;
  const cells = cellCount(size);
  const out: Constraint[] = [];
  const seen = new Set<string>();

  for (const token of text.split(',')) {
    const match = TOKEN.exec(token);
    if (match === null) return null;
    const first = Number(match[1]);
    const gap = match[2];
    const symbol = match[3];
    if (first < 0 || first >= cells) return null;
    if (gap === 'h' && colOf(first, size) >= size - 1) return null;
    if (gap === 'v' && rowOf(first, size) >= size - 1) return null;
    if (seen.has(`${first}${gap}`)) return null;
    seen.add(`${first}${gap}`);

    const second = gap === 'h' ? first + 1 : first + size;
    const constraint =
      symbol === '<' ? { less: first, greater: second } : { less: second, greater: first };
    if (!(solution[constraint.less]! < solution[constraint.greater]!)) return null;
    out.push(constraint);
  }
  return out;
}

/** Decodes persisted givens. Null when any of them disagrees with the solution. */
export function decodeGivens(text: unknown, size: Size, solution: Grid): number[] | null {
  const cells = decodeGrid(text, size);
  if (cells === null) return null;
  const consistent = cells.every((cell, index) => cell === EMPTY || cell === solution[index]);
  return consistent ? cells : null;
}

/** Decodes persisted entries. Null when one of them sits on a given (§11). */
export function decodeEntries(text: unknown, size: Size, givens: Grid): number[] | null {
  const cells = decodeGrid(text, size);
  if (cells === null) return null;
  const clear = cells.every((cell, index) => cell === EMPTY || givens[index] === EMPTY);
  return clear ? cells : null;
}

export function encodeNotes(notes: readonly number[]): string {
  return notes.map((mask) => mask.toString(32)).join(',');
}

/**
 * Decodes persisted notes. Null when a mask holds a digit this size has not
 * got, or when a note sits on a cell that already shows a digit — placing one
 * clears the notes under it (§4), so that record cannot come from play.
 */
export function decodeNotes(text: unknown, size: Size, grid: Grid): number[] | null {
  if (typeof text !== 'string') return null;
  const parts = text === '' ? [] : text.split(',');
  if (parts.length !== cellCount(size)) return null;
  const notes: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-v]{1,2}$/.test(part)) return null;
    const mask = parseInt(part, 32);
    if (!Number.isInteger(mask) || mask < 0 || mask > allCandidates(size)) return null;
    notes.push(mask);
  }
  return notes.every((mask, index) => mask === 0 || grid[index] === EMPTY) ? notes : null;
}

export interface DecodedGame {
  readonly solution: number[];
  readonly constraints: Constraint[];
  readonly board: Board;
}

export interface EncodedGame {
  readonly solution: unknown;
  readonly constraints: unknown;
  readonly givens: unknown;
  readonly entries: unknown;
  readonly notes: unknown;
}

/**
 * The whole board side of one saved game, checked against itself. Null when
 * any single part fails, so a caller has one call to make and one thing to
 * check rather than an order of operations to get right.
 */
export function decodeGame(parts: EncodedGame, size: Size): DecodedGame | null {
  const solution = decodeSolution(parts.solution, size);
  if (solution === null) return null;
  const constraints = decodeConstraints(parts.constraints, size, solution);
  if (constraints === null) return null;
  const givens = decodeGivens(parts.givens, size, solution);
  if (givens === null) return null;
  const entries = decodeEntries(parts.entries, size, givens);
  if (entries === null) return null;
  const merged = givens.map((given, index) => (given !== EMPTY ? given : entries[index]!));
  const notes = decodeNotes(parts.notes, size, merged);
  return notes === null ? null : { solution, constraints, board: { givens, entries, notes } };
}
