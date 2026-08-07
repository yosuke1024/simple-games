/**
 * One move, resolved (docs/CONNECT_FOUR_RULES.md §2, §3): where a disc lands,
 * and whether it finished a line. Pure functions over a plain array — no
 * identity, no time, no randomness.
 *
 * `lineThrough` walks outward from the disc that just landed, so the win
 * check costs four direction scans instead of a sweep of the board — and the
 * line it returns is the one the screen rings (§10): the same cells, from the
 * same walk, so the board and the picture of the board cannot disagree.
 */
import {
  cellAt,
  colOf,
  COLS,
  EMPTY,
  LINE_LENGTH,
  ROWS,
  rowOf,
  type Board,
  type Piece,
  type Side,
} from './types';

/** The row a disc dropped in `col` would land on, or -1 when the column is full. */
export function dropRowOf(board: Board, col: number): number {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[cellAt(row, col)] === EMPTY) return row;
  }
  return -1;
}

/** Every column that can still take a disc, left to right. */
export function legalColumns(board: Board): number[] {
  const columns: number[] = [];
  for (let col = 0; col < COLS; col++) {
    if (dropRowOf(board, col) >= 0) columns.push(col);
  }
  return columns;
}

export function isBoardFull(board: Board): boolean {
  for (let col = 0; col < COLS; col++) {
    if (board[cellAt(0, col)] === EMPTY) return false;
  }
  return true;
}

export interface DropOutcome {
  readonly board: Board;
  /** Where the disc came to rest (§2). */
  readonly cell: number;
}

/** Drops `side`'s disc into `col`. Null when the column is full (§2). */
export function dropDisc(board: Board, side: Side, col: number): DropOutcome | null {
  const row = dropRowOf(board, col);
  if (row < 0) return null;
  const cell = cellAt(row, col);
  const next: Piece[] = [...board];
  next[cell] = side;
  return { board: next, cell };
}

/** The four ways a line can run: along a row, a column, both diagonals. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * The completed line through `cell`, or null. Returns the whole connected
 * run — five in a row is one line, not two — ordered along the direction, so
 * the screen can ring exactly what won (§3, §10).
 */
export function lineThrough(board: Board, cell: number): number[] | null {
  const side = board[cell];
  if (side === EMPTY) return null;
  const row = rowOf(cell);
  const col = colOf(cell);

  for (const [dr, dc] of DIRECTIONS) {
    const run: number[] = [cell];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[cellAt(r, c)] === side) {
        if (sign < 0) run.unshift(cellAt(r, c));
        else run.push(cellAt(r, c));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= LINE_LENGTH) return run;
  }
  return null;
}
