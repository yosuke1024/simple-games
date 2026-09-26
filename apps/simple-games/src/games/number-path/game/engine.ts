/**
 * The board rules of docs/NUMBER_PATH_RULES.md §1–§4: how a grid with numbers
 * and walls is built, which steps a path may take, what a tap and a stroke do
 * to it, and when it is finished. Pure functions over flat arrays — no cell
 * objects, no state, nothing to keep in sync.
 *
 * A path is the only thing the player writes, and it is checked as a prefix
 * (§3): it starts on 1, every step is to an open neighbour, no cell repeats,
 * a numbered cell is entered only when it is the next one due, and nothing
 * extends past K. The win (§2) is that same reading, on a path that covers
 * every cell — never a comparison against the stored solution.
 */
import {
  DIRECTIONS,
  DOWN,
  LEFT,
  MAX_SIDE,
  RIGHT,
  UP,
  type Board,
  type Direction,
  type Path,
} from './types';

export const cellCount = (board: Pick<Board, 'width' | 'height'>): number =>
  board.width * board.height;

export const rowOf = (index: number, width: number): number => Math.floor(index / width);
export const colOf = (index: number, width: number): number => index % width;
export const indexOf = (row: number, col: number, width: number): number => row * width + col;

/** The cell one step in `direction` from `index`, or -1 off the edge of the grid. */
export function neighbourOf(
  index: number,
  direction: Direction,
  width: number,
  height: number,
): number {
  const row = rowOf(index, width);
  const col = colOf(index, width);
  if (direction === UP) return row === 0 ? -1 : index - width;
  if (direction === DOWN) return row === height - 1 ? -1 : index + width;
  if (direction === LEFT) return col === 0 ? -1 : index - 1;
  return col === width - 1 ? -1 : index + 1;
}

/** The direction that takes `from` to `to`, or null when they are not side by side. */
export function directionBetween(from: number, to: number, width: number): Direction | null {
  if (to === from - width) return UP;
  if (to === from + width) return DOWN;
  if (to === from - 1 && colOf(from, width) > 0) return LEFT;
  if (to === from + 1 && colOf(to, width) > 0) return RIGHT;
  return null;
}

/** The wall id of the edge between two side-by-side cells (§9), or null. */
export function wallBetween(a: number, b: number, width: number): string | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (hi === lo + width) return `h${lo}`;
  if (hi === lo + 1 && colOf(hi, width) > 0) return `v${lo}`;
  return null;
}

/** The two cells a wall id separates, or null when the id is not one this grid has. */
export function wallCells(
  id: string,
  width: number,
  height: number,
): readonly [number, number] | null {
  const match = /^([hv])(0|[1-9]\d*)$/.exec(id);
  if (!match) return null;
  const index = Number(match[2]);
  if (index >= width * height) return null;
  if (match[1] === 'h') {
    return rowOf(index, width) === height - 1 ? null : [index, index + width];
  }
  return colOf(index, width) === width - 1 ? null : [index, index + 1];
}

export interface BoardSpec {
  readonly width: number;
  readonly height: number;
  /** The numbered cells as [cell, number] pairs, in any order. */
  readonly numbers: readonly (readonly [number, number])[];
  readonly walls: readonly string[];
}

/**
 * Builds a board, or null when the spec is not one a game could have: a
 * side outside 2..MAX_SIDE, a cell out of range, numbers that are not
 * exactly 1..K each once (K at least 2), or a wall that names no edge. This
 * is the one gate every board passes through — the generator's own boards
 * and the ones read back from a save alike (§9).
 */
export function buildBoard(spec: BoardSpec): Board | null {
  const { width, height } = spec;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 2 || height < 2 || width > MAX_SIDE || height > MAX_SIDE) return null;
  const count = width * height;

  const numbers = new Array<number>(count).fill(0);
  const last = spec.numbers.length;
  if (last < 2 || last > count) return null;
  const cellOf = new Array<number>(last + 1).fill(-1);
  for (const [cell, n] of spec.numbers) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= count) return null;
    if (!Number.isInteger(n) || n < 1 || n > last) return null;
    if (numbers[cell] !== 0 || cellOf[n] !== -1) return null;
    numbers[cell] = n;
    cellOf[n] = cell;
  }

  const open = new Array<number>(count).fill(0);
  for (let index = 0; index < count; index++) {
    for (const direction of DIRECTIONS) {
      if (neighbourOf(index, direction, width, height) >= 0) open[index]! |= direction;
    }
  }
  const walls = new Set<string>();
  for (const id of spec.walls) {
    const cells = wallCells(id, width, height);
    if (cells === null || walls.has(id)) return null;
    walls.add(id);
    const [a, b] = cells;
    const forward = directionBetween(a, b, width)!;
    open[a]! &= ~forward;
    open[b]! &= ~opposite(forward);
  }

  const adjacent = open.map((mask, index) =>
    DIRECTIONS.filter((direction) => (mask & direction) !== 0).map((direction) =>
      neighbourOf(index, direction, width, height),
    ),
  );

  return {
    width,
    height,
    numbers,
    last,
    cellOf,
    open,
    adjacent,
    walls: [...walls].sort(),
  };
}

export function opposite(direction: Direction): Direction {
  if (direction === UP) return DOWN;
  if (direction === DOWN) return UP;
  if (direction === LEFT) return RIGHT;
  return LEFT;
}

/** True when `to` is one open step from `from` — side by side, no wall between. */
export function isOpen(board: Board, from: number, to: number): boolean {
  const direction = directionBetween(from, to, board.width);
  return direction !== null && (board.open[from]! & direction) !== 0;
}

/** The cell carrying number 1 — where every path starts (§3). */
export const startCell = (board: Board): number => board.cellOf[1]!;

/** The cell carrying K — where every path has to end (§2). */
export const endCell = (board: Board): number => board.cellOf[board.last]!;

/** An untouched path: the 1 cell alone. */
export const emptyPath = (board: Board): Path => [startCell(board)];

/**
 * The number the path is due to reach next (§3). Numbers are entered in
 * order, so the count of numbered cells on the path is the highest one
 * reached, and the next is one more — K + 1 once the path has ended on K.
 */
export function nextNumber(board: Board, path: Path): number {
  let reached = 0;
  for (const cell of path) if (board.numbers[cell] !== 0) reached++;
  return reached + 1;
}

/**
 * Whether the path may take one more step onto `to` (§3): from its end, to an
 * open neighbour it has not visited, onto a numbered cell only when that
 * number is due, and never past K. The reasons are the rules; there is no
 * error to show for a step that is simply not taken.
 */
export function canExtend(board: Board, path: Path, to: number): boolean {
  const end = path[path.length - 1];
  if (end === undefined) return false;
  if (board.numbers[end] === board.last) return false;
  if (!isOpen(board, end, to)) return false;
  if (path.includes(to)) return false;
  const number = board.numbers[to]!;
  return number === 0 || number === nextNumber(board, path);
}

/** The path with `to` added — the caller has asked `canExtend` first. */
export const extend = (path: Path, to: number): Path => [...path, to];

/**
 * The path cut back so that `cell` is its end (§4). Null when the cell is
 * not on the path; the same path when it already ends there. The 1 cell
 * can never be removed — a path is never shorter than its start (§4).
 */
export function truncate(path: Path, cell: number): Path | null {
  const at = path.indexOf(cell);
  if (at < 0) return null;
  return at === path.length - 1 ? path : path.slice(0, at + 1);
}

/**
 * One trace over the board — a tap, or the cells a stroke passed through, in
 * order (§4). Each cell is read the same way: the end of the path changes
 * nothing; a cell already on the path cuts the path back to it (dragging
 * back along a path unpicks it, and a tap anywhere on it does the same); a
 * cell the path may step onto extends it; anything else — a wall, a cell out
 * of reach, a number not yet due — is simply not taken.
 *
 * Returns the same path instance when nothing changed, so a caller can tell
 * a stroke that drew from one that did not without comparing arrays.
 */
export function applyTrace(board: Board, path: Path, cells: readonly number[]): Path {
  let current = path;
  for (const cell of cells) {
    if (cell === current[current.length - 1]) continue;
    const cut = truncate(current, cell);
    if (cut !== null) {
      current = cut;
      continue;
    }
    if (canExtend(board, current, cell)) current = extend(current, cell);
  }
  return current;
}

/**
 * Whether a path is one play could have drawn (§3, §9): it starts on 1,
 * every step is open, no cell repeats, numbers arrive in order, and nothing
 * follows K. Used for the fail-closed read of a save and, with the two
 * checks below, for the win.
 */
export function isLegalPrefix(board: Board, path: Path): boolean {
  if (path.length === 0 || path.length > cellCount(board)) return false;
  if (path[0] !== startCell(board)) return false;
  const seen = new Set<number>();
  let due = 1;
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]!;
    if (!Number.isInteger(cell) || cell < 0 || cell >= cellCount(board)) return false;
    if (seen.has(cell)) return false;
    seen.add(cell);
    if (i > 0 && !isOpen(board, path[i - 1]!, cell)) return false;
    const number = board.numbers[cell]!;
    if (number !== 0) {
      if (number !== due) return false;
      due++;
      // K ends the path: a cell after it is a step the rules never allow.
      if (number === board.last && i !== path.length - 1) return false;
    }
  }
  return true;
}

/**
 * Won when the path is legal, covers every cell, and ends on K (§2). A legal
 * prefix that covers the whole board has met every number on the way, so
 * "in order" needs no second reading here.
 */
export function isSolution(board: Board, path: Path): boolean {
  return (
    path.length === cellCount(board) &&
    board.numbers[path[path.length - 1]!] === board.last &&
    isLegalPrefix(board, path)
  );
}

/** The first position where the path leaves `solution`, or -1 while it is a prefix of it. */
export function firstDeviation(path: Path, solution: Path): number {
  for (let i = 0; i < path.length; i++) if (path[i] !== solution[i]) return i;
  return -1;
}
