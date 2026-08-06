/**
 * Board rules (docs/BLOCK_PUZZLE_RULES.md §3, §4, §5, §2). Every function
 * here is pure and takes the board it works on, so the same code answers
 * "what would happen" for the drag ghost and "what happened" for the session.
 *
 * Rows and columns clear together in one pass (§4). Doing it in two — rows,
 * then columns of the already-cleared board — would lose a column that only
 * the row's cells completed, and a placement that fills the last cell of both
 * would score as one line instead of two.
 */
import type { Piece } from './pieces';
import { BOARD_SIZE, CELL_COUNT, inBounds, indexAt, type Board } from './types';

/** Where a piece's cells land on the board. Call only for a legal placement. */
export function pieceCells(piece: Piece, row: number, col: number): readonly number[] {
  return piece.cells.map((offset) => indexAt(row + offset.row, col + offset.col));
}

/** True when every cell of the piece lands on the board, and on empty space (§3). */
export function canPlace(board: Board, piece: Piece, row: number, col: number): boolean {
  for (const offset of piece.cells) {
    const r = row + offset.row;
    const c = col + offset.col;
    if (!inBounds(r, c)) return false;
    if (board[indexAt(r, c)]) return false;
  }
  return true;
}

export interface Placement {
  readonly board: Board;
  /** How many squares the piece put down — the base of its score (§5). */
  readonly cells: number;
}

/** Fills the piece's cells. The caller checks `canPlace` first (§3). */
export function place(board: Board, piece: Piece, row: number, col: number): Placement {
  const next = [...board];
  for (const offset of piece.cells) next[indexAt(row + offset.row, col + offset.col)] = true;
  return { board: next, cells: piece.cells.length };
}

export interface ClearResult {
  readonly board: Board;
  /** Full rows plus full columns, each counted once (§4). */
  readonly lines: number;
}

/**
 * Removes every full row and full column at once (§4). The rows and columns
 * are read from the incoming board before anything is emptied, so a cell two
 * finished lines share is not what decides whether the second one counts.
 */
export function clearLines(board: Board): ClearResult {
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    let full = true;
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!board[indexAt(row, col)]) {
        full = false;
        break;
      }
    }
    if (full) fullRows.push(row);
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    let full = true;
    for (let row = 0; row < BOARD_SIZE; row++) {
      if (!board[indexAt(row, col)]) {
        full = false;
        break;
      }
    }
    if (full) fullCols.push(col);
  }

  const lines = fullRows.length + fullCols.length;
  if (lines === 0) return { board, lines: 0 };

  const next = [...board];
  for (const row of fullRows)
    for (let col = 0; col < BOARD_SIZE; col++) next[indexAt(row, col)] = false;
  for (const col of fullCols)
    for (let row = 0; row < BOARD_SIZE; row++) next[indexAt(row, col)] = false;
  return { board: next, lines };
}

/**
 * One placement's points (§5): a point per square put down, plus
 * `10 × n × (n + 1) / 2` for clearing n lines at once — 10, 30, 60, 100.
 * Quadratic and no further: a bonus that grows faster than this turns one
 * lucky placement into the whole game, and the game is meant to be the
 * hundred placements around it.
 */
export function scoreFor(cells: number, lines: number): number {
  return cells + (10 * lines * (lines + 1)) / 2;
}

/**
 * Which cells the clear emptied — what the fade is drawn on (§12). Derived
 * from the public before/after boards rather than reported by `clearLines`,
 * so the session stays a plain snapshot: a cell was cleared when the new
 * board does not hold it and either the old board did or the piece just
 * filled it.
 */
export function clearedCells(
  before: Board,
  after: Board,
  filled: readonly number[],
): readonly number[] {
  const out: number[] = [];
  for (let index = 0; index < CELL_COUNT; index++) {
    if (!after[index] && (before[index] || filled.indexOf(index) !== -1)) out.push(index);
  }
  return out;
}

/**
 * Whether any of the pieces still fits anywhere (§2). False is the end of the
 * game — and it is reached by the board and the draw alone, because the draw
 * never looks at the board (§6).
 */
export function hasAnyMove(board: Board, pieces: readonly Piece[]): boolean {
  for (const piece of pieces) {
    for (let row = 0; row <= BOARD_SIZE - piece.height; row++) {
      for (let col = 0; col <= BOARD_SIZE - piece.width; col++) {
        if (canPlace(board, piece, row, col)) return true;
      }
    }
  }
  return false;
}
