/**
 * The board rules of docs/BINARY_BALANCE_RULES.md §2, §3, §4 and §9: the three
 * rules, the tap cycle, the always-on violation display, and the win. Pure
 * functions over flat arrays — no cell objects, no state, nothing to keep in
 * sync.
 *
 * The player's board is two arrays, not one: `givens` holds the cells the
 * puzzle fixed and `marks` holds what the player wrote, empty wherever a given
 * sits (§1). `mergeBoard` is the reading everything else works on.
 *
 * There is no "no two lines alike" rule here, on purpose (§3, §14): two
 * finished rows that read the same are legal in this game.
 */
import {
  EMPTY,
  CIRCLE,
  SQUARE,
  cellCount,
  halfLine,
  linkOther,
  type Link,
  type LinkDir,
  type Line,
  type Mark,
  type Size,
} from './types';

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

/** The line a link runs along: its row for `h`, its column for `v`. */
export function lineOfLink(link: Pick<Link, 'index' | 'dir'>, size: number): Line {
  return link.dir === 'h'
    ? { axis: 'row', index: rowOf(link.index, size) }
    : { axis: 'col', index: colOf(link.index, size) };
}

/** An empty player board: nothing written anywhere. */
export function emptyMarks(size: Size): Mark[] {
  return new Array<Mark>(cellCount(size)).fill(EMPTY);
}

/** The board as it reads on screen: the player's marks over the givens. */
export function mergeBoard(givens: readonly Mark[], marks: readonly Mark[]): Mark[] {
  return givens.map((given, index) => (given === EMPTY ? (marks[index] ?? EMPTY) : given));
}

/**
 * Every edge between two neighbouring cells, `h` then `v` per cell in
 * row-major order: 60 on a 6×6 (§6 step 2).
 */
export function allEdges(size: number): { index: number; dir: LinkDir }[] {
  const out: { index: number; dir: LinkDir }[] = [];
  for (let index = 0; index < cellCount(size); index++) {
    if (colOf(index, size) < size - 1) out.push({ index, dir: 'h' });
    if (rowOf(index, size) < size - 1) out.push({ index, dir: 'v' });
  }
  return out;
}

/**
 * Whether a set of links could have come from a board (§11): every link
 * names a real edge — never off the right edge for `h` or off the bottom for
 * `v` — and no edge is named twice.
 */
export function isValidLinks(links: readonly Link[], size: number): boolean {
  const seen = new Set<string>();
  for (const link of links) {
    if (!Number.isInteger(link.index) || link.index < 0 || link.index >= cellCount(size)) {
      return false;
    }
    if (link.dir === 'h' && colOf(link.index, size) === size - 1) return false;
    if (link.dir === 'v' && rowOf(link.index, size) === size - 1) return false;
    if (link.dir !== 'h' && link.dir !== 'v') return false;
    const key = `${link.dir}${link.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/**
 * One tap: empty → circle → square → empty (§4). Returns null when nothing can
 * change — an index out of range, or a given, which no tap ever moves.
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
  next[index] = current === EMPTY ? CIRCLE : current === CIRCLE ? SQUARE : EMPTY;
  return next;
}

/**
 * What the board currently breaks (§9), flagged per cell so the board can tint
 * the offending marks, per link so the `=` / `×` between them can tint too,
 * and per line for the hint.
 *
 * A statement about the rules, never a comparison against the hidden
 * solution: a legal mark that is not the final one is told nothing (§9).
 */
export interface Violations {
  /** One flag per cell, row-major: this cell takes part in a broken rule. */
  readonly cells: readonly boolean[];
  /** One flag per link, in the order the links were given. */
  readonly links: readonly boolean[];
  readonly rows: readonly boolean[];
  readonly cols: readonly boolean[];
  /** True when anything at all is flagged — the cheap read for the hint (§8). */
  readonly any: boolean;
}

export function findViolations(
  board: readonly Mark[],
  links: readonly Link[],
  size: Size,
): Violations {
  const cells = new Array<boolean>(cellCount(size)).fill(false);
  const linkFlags = new Array<boolean>(links.length).fill(false);
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
    for (let index = 0; index < size; index++) {
      const line: Line = { axis, index };
      const indices = lineIndices(size, line);
      const values = indices.map((i) => board[i] ?? EMPTY);

      // Rule 1: three identical marks running together.
      for (let i = 0; i + 2 < size; i++) {
        const mark = values[i];
        if (mark === EMPTY || mark === undefined) continue;
        if (values[i + 1] === mark && values[i + 2] === mark) {
          flag(line, [indices[i]!, indices[i + 1]!, indices[i + 2]!]);
        }
      }

      // Rule 2: more than half a line given over to one mark. Flagged while
      // the line is still filling, because by then it is already unfixable.
      for (const mark of [CIRCLE, SQUARE] as const) {
        const held = indices.filter((_, i) => values[i] === mark);
        if (held.length > half) flag(line, held);
      }
    }
  }

  // Rule 3: a link whose two cells disagree with it.
  links.forEach((link, k) => {
    const a = board[link.index] ?? EMPTY;
    const b = board[linkOther(link, size)] ?? EMPTY;
    if (a === EMPTY || b === EMPTY) return;
    if ((a === b) === link.same) return;
    linkFlags[k] = true;
    cells[link.index] = true;
    cells[linkOther(link, size)] = true;
    const line = lineOfLink(link, size);
    if (line.axis === 'row') rows[line.index] = true;
    else cols[line.index] = true;
    any = true;
  });

  return { cells, links: linkFlags, rows, cols, any };
}

export const isFull = (board: readonly Mark[]): boolean => board.every((cell) => cell !== EMPTY);

/**
 * Won when the board is full and no rule is broken (§2) — never a comparison
 * against the solution. Read through `findViolations` on purpose, so the
 * display and the verdict can never disagree. On a full line "no mark more
 * than half the time" is exactly "half of each".
 */
export function isSolved(board: readonly Mark[], links: readonly Link[], size: Size): boolean {
  // `every` on a board of the wrong length is vacuously true, so the length
  // is checked first: an empty array must never read as a win.
  if (board.length !== cellCount(size)) return false;
  return isFull(board) && !findViolations(board, links, size).any;
}
