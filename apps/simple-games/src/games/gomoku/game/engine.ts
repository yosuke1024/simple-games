/**
 * One move, resolved (docs/GOMOKU_RULES.md §2, §3): where a stone goes, and
 * whether it finished a line. Pure functions over a plain array — no
 * identity, no time, no randomness.
 *
 * `lineThrough` walks outward from the stone that just landed, so the win
 * check costs four direction scans instead of a sweep of two hundred and
 * twenty-five intersections — and the line it returns is the one the screen
 * rings (§10): the same cells, from the same walk, so the board and the
 * picture of the board cannot disagree.
 */
import {
  EMPTY,
  SIZE,
  WIN_LENGTH,
  cellAt,
  colOf,
  rowOf,
  type Board,
  type Piece,
  type Player,
} from './types';

/** The four ways a line can run: along a row, a column, both diagonals. */
export const DIRECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < SIZE && col >= 0 && col < SIZE;

/** Every empty intersection, in reading order. Legal moves are exactly these. */
export function legalMoves(board: Board): number[] {
  const moves: number[] = [];
  for (let cell = 0; cell < board.length; cell++) {
    if (board[cell] === EMPTY) moves.push(cell);
  }
  return moves;
}

export function isBoardFull(board: Board): boolean {
  for (const piece of board) {
    if (piece === EMPTY) return false;
  }
  return true;
}

/** Puts `player`'s stone on `cell`. Null when that intersection is taken (§2). */
export function placeStone(board: Board, player: Player, cell: number): Board | null {
  if (cell < 0 || cell >= board.length || board[cell] !== EMPTY) return null;
  const next: Piece[] = [...board];
  next[cell] = player;
  return next;
}

/**
 * The completed line through `cell`, or null. Returns the whole connected run
 * — six in a row is one line, not two, and it wins (§3, §11) — ordered along
 * the direction, so the screen can ring exactly what won (§10).
 */
export function lineThrough(board: Board, cell: number): number[] | null {
  const player = board[cell];
  if (player === EMPTY || player === undefined) return null;
  const row = rowOf(cell);
  const col = colOf(cell);

  for (const [dr, dc] of DIRECTIONS) {
    const run: number[] = [cell];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (inBounds(r, c) && board[cellAt(r, c)] === player) {
        if (sign < 0) run.unshift(cellAt(r, c));
        else run.push(cellAt(r, c));
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (run.length >= WIN_LENGTH) return run;
  }
  return null;
}

/** The first completed line anywhere, with its owner — for a restored board. */
export function findWinner(board: Board): { line: number[]; player: Player } | null {
  for (let cell = 0; cell < board.length; cell++) {
    const piece = board[cell];
    if (piece === EMPTY) continue;
    const line = lineThrough(board, cell);
    if (line !== null) return { line, player: piece as Player };
  }
  return null;
}
