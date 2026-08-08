/**
 * Compact, corruption-tolerant serialization for local persistence
 * (docs/KAKURO_RULES.md §11).
 *
 * Four strings travel, and a fifth deliberately does not:
 * - the layout: one character per cell, row-major, '#' for a clue cell and '.'
 *   for a white one. A whole 10×10 board is 100 characters.
 * - the solution: one character per cell, '1'..'9' in a white cell and '.' in
 *   a clue cell — the same alphabet the entries use, so one decoder reads both.
 * - the entries: the player's digits, in that same shape.
 * - the notes: one mask per cell in base 32, comma-separated, the same form
 *   Sudoku uses. Nine digits is nine bits, so a mask is never wider than two
 *   characters.
 *
 * **The clues are not serialized (§11).** A clue is the sum of the run behind
 * it, so layout plus solution is already the whole of it, and storing a second
 * copy would create a record where one half can be stale or damaged while the
 * other is not — and with it the obligation to write the code that detects
 * that. `buildRuns` recomputes them here exactly as generation computed them,
 * which is why "the clue disagrees with the answer" is not a state this game
 * can reach, in a save file or anywhere else. **A state that cannot be
 * represented does not have to be validated.**
 *
 * Decoding fails closed, and closed here means more than "the characters
 * parse". A record only survives if it is a record play could have produced:
 * the layout is a board this game would have generated (§1 — runs of two to
 * nine, nothing white on the two rails, the white cells one region), every
 * white cell of the solution holds a digit and no run repeats one (§3 rule 1),
 * no entry and no note sits on a clue cell, and no note sits under a digit. A
 * save that fails any of those did not come from this game, and the caller
 * drops it for a fresh board rather than handing the player a puzzle with no
 * answer.
 *
 * §3's rule 2 — the run adds to its clue — is the one thing not checked, and
 * that is not an omission. The clues are built from this solution, so a run
 * adds to its clue by construction. It is the check that not storing the clues
 * deleted.
 */
import { buildRuns, type Board } from './engine';
import {
  ALL_DIGITS,
  BLOCK,
  EMPTY,
  WHITE,
  bitOf,
  cellCount,
  hasBit,
  isWhite,
  type CellKind,
  type Layout,
  type RunTable,
  type Size,
} from './types';

const EMPTY_CHARACTER = '.';
const BLOCK_CHARACTER = '#';

export function encodeLayout(layout: Layout): string {
  return layout.cells.map((cell) => (cell === WHITE ? EMPTY_CHARACTER : BLOCK_CHARACTER)).join('');
}

/**
 * Decodes a persisted layout. Null unless it is a board this game could have
 * built: the shape is checked here and the Kakuro rules of §1 are checked by
 * `buildRuns` in `decodeGame`, which is the one function that knows them.
 */
export function decodeLayout(text: unknown, size: Size): Layout | null {
  if (typeof text !== 'string' || text.length !== size * size) return null;
  const cells: CellKind[] = [];
  for (const character of text) {
    if (character === BLOCK_CHARACTER) cells.push(BLOCK);
    else if (character === EMPTY_CHARACTER) cells.push(WHITE);
    else return null;
  }
  return { width: size, height: size, cells };
}

/** Encodes a solution or an entries grid — both are digits over one layout. */
export function encodeGrid(cells: readonly number[]): string {
  return cells.map((cell) => (cell === EMPTY ? EMPTY_CHARACTER : String(cell))).join('');
}

function decodeGrid(text: unknown, layout: Layout): number[] | null {
  if (typeof text !== 'string' || text.length !== cellCount(layout)) return null;
  const cells: number[] = [];
  for (const character of text) {
    if (character === EMPTY_CHARACTER) {
      cells.push(EMPTY);
      continue;
    }
    const value = Number(character);
    if (!Number.isInteger(value) || value < 1 || value > 9) return null;
    cells.push(value);
  }
  // Nothing may sit on a clue cell, and no white cell of the answer may be
  // blank — both are shapes play cannot write (§11).
  return cells.every((cell, index) => (isWhite(layout, index) ? true : cell === EMPTY))
    ? cells
    : null;
}

/**
 * Decodes a persisted solution. Null unless every white cell holds a digit and
 * no run holds one twice (§3 rule 1) — the invariant everything else leans on.
 */
export function decodeSolution(text: unknown, layout: Layout, table: RunTable): number[] | null {
  const cells = decodeGrid(text, layout);
  if (cells === null) return null;
  if (!table.white.every((index) => cells[index] !== EMPTY)) return null;
  for (const run of table.runs) {
    let seen = 0;
    for (const index of run.cells) {
      const value = cells[index]!;
      if (hasBit(seen, value)) return null;
      seen |= bitOf(value);
    }
  }
  return cells;
}

/**
 * Decodes the player's digits. Null when one sits on a clue cell — which is
 * this game's version of "an entry on top of a given" (§11), and the only one
 * it has, because a Kakuro hands out no digits at all (§1).
 */
export function decodeEntries(text: unknown, layout: Layout): number[] | null {
  return decodeGrid(text, layout);
}

export function encodeNotes(notes: readonly number[]): string {
  return notes.map((mask) => mask.toString(32)).join(',');
}

/**
 * Decodes persisted notes. Null when a mask holds a bit outside 1..9, when a
 * note sits on a clue cell, or when one sits on a cell that already shows a
 * digit — placing one clears the notes under it (§4), so that record cannot
 * come from play.
 */
export function decodeNotes(
  text: unknown,
  layout: Layout,
  entries: readonly number[],
): number[] | null {
  if (typeof text !== 'string') return null;
  const parts = text === '' ? [] : text.split(',');
  if (parts.length !== cellCount(layout)) return null;
  const notes: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-v]{1,2}$/.test(part)) return null;
    const mask = parseInt(part, 32);
    if (!Number.isInteger(mask) || mask < 0 || mask > ALL_DIGITS) return null;
    notes.push(mask);
  }
  return notes.every(
    (mask, index) => mask === 0 || (isWhite(layout, index) && entries[index] === EMPTY),
  )
    ? notes
    : null;
}

export interface DecodedGame {
  readonly layout: Layout;
  readonly solution: number[];
  /** The runs with their clues — recomputed here, never read from the record. */
  readonly table: RunTable;
  readonly board: Board;
}

export interface EncodedGame {
  readonly layout: unknown;
  readonly solution: unknown;
  readonly entries: unknown;
  readonly notes: unknown;
}

/**
 * The whole board side of one saved game, checked against itself. Null when
 * any single part fails, so a caller has one call to make and one thing to
 * check rather than an order of operations to get right.
 *
 * The order is forced: the layout says what the other three mean, and the
 * clues cannot be rebuilt until the solution is known to be digits.
 */
export function decodeGame(parts: EncodedGame, size: Size): DecodedGame | null {
  const layout = decodeLayout(parts.layout, size);
  if (layout === null) return null;

  // A grid of the right shape whose digits are only checked for range — enough
  // to add the runs up, which is what turns the layout into a run table. The
  // rules that grid has to keep are checked immediately below, on the table.
  const rough = decodeGrid(parts.solution, layout);
  if (rough === null) return null;
  const table = buildRuns(layout, rough);
  if (table === null) return null;

  const solution = decodeSolution(parts.solution, layout, table);
  if (solution === null) return null;
  const entries = decodeEntries(parts.entries, layout);
  if (entries === null) return null;
  const notes = decodeNotes(parts.notes, layout, entries);
  if (notes === null) return null;

  return { layout, solution, table, board: { entries, notes } };
}
