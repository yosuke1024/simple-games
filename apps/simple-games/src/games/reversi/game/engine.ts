/**
 * One move, resolved (docs/REVERSI_RULES.md §2): where a player may place a
 * disc, and which discs a placement turns. Pure functions over a plain array
 * — no identity, no time, no randomness.
 *
 * `collectFlips` is the whole rule and everything else is a view of it: a
 * cell is legal exactly when it flips something, and a move's effect is
 * exactly its flips. The screen animates the same list the session took, so
 * the board and the picture of the board cannot disagree.
 *
 * The board is typed `ArrayLike<number>` rather than `Board` in the hot
 * functions on purpose: the CPU searches over an `Int8Array` it makes and
 * unmakes in place (cpu.ts), and that must run *these* rules rather than a
 * second copy of them written for speed.
 */
import {
  BOARD_SIZE,
  colOf,
  EMPTY,
  opponentOf,
  rowOf,
  type Board,
  type Piece,
  type Player,
} from './types';

/**
 * The eight directions a line of captured discs can run (§2), as two flat
 * lists rather than eight pairs. The CPU walks these millions of times per
 * turn, and a pair per step is a pair allocated per step.
 */
const DR: readonly number[] = [-1, -1, -1, 0, 0, 1, 1, 1];
const DC: readonly number[] = [-1, 0, 1, -1, 1, -1, 0, 1];

/**
 * Writes every disc `player` would turn by placing on `cell` into `out`,
 * starting at `offset`, and returns how many were written — 0 when the
 * placement is illegal, including when the cell is already occupied (§2).
 *
 * Caller-supplied buffer, so a search can run this at every node without
 * allocating: the recursion needs its own space per ply, which a buffer
 * owned by this module could not give it.
 */
export function collectFlips(
  board: ArrayLike<number>,
  player: Player,
  cell: number,
  out: Int32Array,
  offset: number,
): number {
  if (board[cell] !== EMPTY) return 0;
  const opponent = opponentOf(player);
  const row = rowOf(cell);
  const col = colOf(cell);
  let written = 0;

  for (let direction = 0; direction < 8; direction++) {
    const dr = DR[direction]!;
    const dc = DC[direction]!;
    let r = row + dr;
    let c = col + dc;
    let run = 0;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const piece = board[r * BOARD_SIZE + c]!;
      if (piece === opponent) {
        run += 1;
      } else {
        // A run counts only when it is closed by one of the player's own
        // discs; a line that reaches an empty cell or the edge captures
        // nothing (§2).
        if (piece === player && run > 0) {
          let back = r - dr;
          let backCol = c - dc;
          for (let step = 0; step < run; step++) {
            out[offset + written] = back * BOARD_SIZE + backCol;
            written += 1;
            back -= dr;
            backCol -= dc;
          }
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return written;
}

/** A capture can never turn more discs than the board has cells. */
const scratch = new Int32Array(BOARD_SIZE * BOARD_SIZE);

/**
 * Every disc `player` would turn by placing on `cell`. Empty when the
 * placement is illegal (§2). For the session and the screen; the CPU uses
 * `collectFlips` directly so it can keep its own buffers.
 */
export function flipsFor(board: Board, player: Player, cell: number): number[] {
  const count = collectFlips(board, player, cell, scratch, 0);
  const flips: number[] = [];
  for (let i = 0; i < count; i++) flips.push(scratch[i]!);
  return flips;
}

/**
 * Whether the placement is legal, without collecting what it would turn.
 * Same rule as `collectFlips`, stopping at the first closed run: the CPU
 * asks this of every empty cell of every position it reads, so the work
 * saved here is the work saved per node.
 */
export function isLegalMove(board: ArrayLike<number>, player: Player, cell: number): boolean {
  if (board[cell] !== EMPTY) return false;
  const opponent = opponentOf(player);
  const row = rowOf(cell);
  const col = colOf(cell);

  for (let direction = 0; direction < 8; direction++) {
    const dr = DR[direction]!;
    const dc = DC[direction]!;
    let r = row + dr;
    let c = col + dc;
    let seen = false;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
      const piece = board[r * BOARD_SIZE + c]!;
      if (piece === opponent) {
        seen = true;
      } else {
        if (piece === player && seen) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return false;
}

/** Every cell `player` may place on, in board order. */
export function legalMovesOf(board: ArrayLike<number>, player: Player): number[] {
  const moves: number[] = [];
  for (let cell = 0; cell < board.length; cell++) {
    if (isLegalMove(board, player, cell)) moves.push(cell);
  }
  return moves;
}

/**
 * Writes `player`'s legal cells into `out` and returns how many — the
 * allocation-free twin of `legalMovesOf`, for the search.
 */
export function collectLegalMoves(
  board: ArrayLike<number>,
  player: Player,
  out: Int32Array,
): number {
  let count = 0;
  for (let cell = 0; cell < board.length; cell++) {
    if (isLegalMove(board, player, cell)) {
      out[count] = cell;
      count += 1;
    }
  }
  return count;
}

/** How many moves `player` has — mobility, without the list (cpu.ts). */
export function countLegalMoves(board: ArrayLike<number>, player: Player): number {
  let count = 0;
  for (let cell = 0; cell < board.length; cell++) {
    if (isLegalMove(board, player, cell)) count += 1;
  }
  return count;
}

export function hasAnyMove(board: ArrayLike<number>, player: Player): boolean {
  for (let cell = 0; cell < board.length; cell++) {
    if (isLegalMove(board, player, cell)) return true;
  }
  return false;
}

export interface PlacementOutcome {
  readonly board: Board;
  /** The discs the move turned — never empty for a legal move (§2). */
  readonly flipped: readonly number[];
}

/** Places `player`'s disc on `cell` and turns every capture. Null when illegal. */
export function placeDisc(board: Board, player: Player, cell: number): PlacementOutcome | null {
  const flipped = flipsFor(board, player, cell);
  if (flipped.length === 0) return null;
  const next: Piece[] = [...board];
  next[cell] = player;
  for (const index of flipped) next[index] = player;
  return { board: next, flipped };
}
