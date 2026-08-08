/**
 * The board rules of docs/TAKUZU_RULES.md §2, §3, §4 and §9: the three rules,
 * the tap cycle, the always-on violation display, and the win. Pure functions
 * over flat arrays — no cell objects, no state, nothing to keep in sync.
 *
 * The player's board is two arrays, not one: `givens` holds the cells the
 * puzzle fixed and `marks` holds what the player wrote, empty wherever a given
 * sits. Keeping them apart is what lets the save format state its fail-closed
 * invariant as a fact about the data (§11: a mark on top of a given is
 * corruption, not a move), instead of as a rule someone has to remember.
 * `mergeBoard` is the reading everything else works on.
 */
import { EMPTY, ONE, ZERO, cellCount, halfLine, type Line, type Mark, type Size } from './types';

export const rowOf = (index: number, size: number): number => Math.floor(index / size);
export const colOf = (index: number, size: number): number => index % size;

/** The row-major indices of one row. */
export function rowIndices(size: number, row: number): number[] {
  const out: number[] = [];
  for (let col = 0; col < size; col++) out.push(row * size + col);
  return out;
}

/** The row-major indices of one column. */
export function colIndices(size: number, col: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < size; row++) out.push(row * size + col);
  return out;
}

/** The indices of one line, whichever axis it runs along. */
export function lineIndices(size: number, line: Line): number[] {
  return line.axis === 'row' ? rowIndices(size, line.index) : colIndices(size, line.index);
}

/** An empty player board: nothing written anywhere. */
export function emptyMarks(size: Size): Mark[] {
  return new Array<Mark>(cellCount(size)).fill(EMPTY);
}

/** The board as it reads on screen: the player's digits over the givens. */
export function mergeBoard(givens: readonly Mark[], marks: readonly Mark[]): Mark[] {
  return givens.map((given, index) => (given === EMPTY ? (marks[index] ?? EMPTY) : given));
}

/**
 * One tap: empty → 0 → 1 → empty (§4). Returns null when nothing can change —
 * an index out of range, or a given, which no tap ever moves.
 *
 * The cycle is the whole of the input vocabulary. There is no note mode and no
 * second gesture, which is also why there is no Undo (§8): every state of a
 * cell is two taps away from every other.
 */
export function cycleCell(
  givens: readonly Mark[],
  marks: readonly Mark[],
  index: number,
): Mark[] | null {
  if (index < 0 || index >= marks.length) return null;
  if (givens[index] !== EMPTY) return null;
  const next = [...marks];
  const current = marks[index] ?? EMPTY;
  next[index] = current === EMPTY ? ZERO : current === ZERO ? ONE : EMPTY;
  return next;
}

/**
 * What the board currently breaks (§9), flagged per cell so the board can tint
 * the offending digits, and per line so the rails can tint with them.
 *
 * This is a statement about the rules, not a comparison against the hidden
 * solution: a player who writes a legal-but-not-final digit is told nothing,
 * because nothing is wrong yet (§9 — there is no mistake display here).
 */
export interface Violations {
  /** One flag per cell, row-major: this cell takes part in a broken rule. */
  readonly cells: readonly boolean[];
  readonly rows: readonly boolean[];
  readonly cols: readonly boolean[];
  /** True when anything at all is flagged — the cheap read for the hint (§8). */
  readonly any: boolean;
}

export function findViolations(board: readonly Mark[], size: Size): Violations {
  const cells = new Array<boolean>(cellCount(size)).fill(false);
  const rows = new Array<boolean>(size).fill(false);
  const cols = new Array<boolean>(size).fill(false);
  const half = halfLine(size);
  let any = false;

  const flag = (line: Line, indices: readonly number[]): void => {
    for (const index of indices) cells[index] = true;
    if (line.axis === 'row') rows[line.index] = true;
    else cols[line.index] = true;
    any = true;
  };

  for (const axis of ['row', 'col'] as const) {
    const contents: Mark[][] = [];

    for (let index = 0; index < size; index++) {
      const line: Line = { axis, index };
      const indices = lineIndices(size, line);
      const values = indices.map((i) => board[i] ?? EMPTY);
      contents.push(values);

      // Rule 1: three identical digits running together.
      for (let i = 0; i + 2 < size; i++) {
        const digit = values[i];
        if (digit === EMPTY || digit === undefined) continue;
        if (values[i + 1] === digit && values[i + 2] === digit) {
          flag(line, [indices[i]!, indices[i + 1]!, indices[i + 2]!]);
        }
      }

      // Rule 2: more than half a line given over to one digit. Flagged while
      // the line is still filling, because by then it is already unfixable.
      for (const digit of [ZERO, ONE] as const) {
        const held = indices.filter((_, i) => values[i] === digit);
        if (held.length > half) flag(line, held);
      }
    }

    // Rule 3: two finished lines reading the same. Unfinished lines are left
    // alone — they are not yet a repeat of anything.
    for (let a = 0; a < size; a++) {
      const first = contents[a]!;
      if (first.some((value) => value === EMPTY)) continue;
      for (let b = a + 1; b < size; b++) {
        const second = contents[b]!;
        if (second.some((value) => value === EMPTY)) continue;
        if (!first.every((value, i) => value === second[i])) continue;
        flag({ axis, index: a }, lineIndices(size, { axis, index: a }));
        flag({ axis, index: b }, lineIndices(size, { axis, index: b }));
      }
    }
  }

  return { cells, rows, cols, any };
}

export const isFull = (board: readonly Mark[]): boolean => board.every((cell) => cell !== EMPTY);

/**
 * Won when the board is full and no rule is broken (§2).
 *
 * Read through `findViolations` on purpose, so the display and the verdict can
 * never disagree — a board the player is told is clean but that refuses to
 * finish would be the worst bug this game could have. The two readings do
 * coincide: on a full board "no digit appears more than half the time" forces
 * exactly half of each, since the two counts sum to the line length.
 */
export function isSolved(board: readonly Mark[], size: Size): boolean {
  return isFull(board) && !findViolations(board, size).any;
}
