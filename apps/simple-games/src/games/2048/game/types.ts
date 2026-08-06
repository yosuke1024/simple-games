/**
 * Core 2048 types. See docs/GAME_2048_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is 16 cells, row-major, holding powers of two with 0 for empty
 * (§1). Cells carry a number and nothing else — no pictures, no words — which
 * is what makes one board legible in every language at once
 * (docs/I18N_POLICY.md).
 */

/** 4×4, and only 4×4 in this release (§13). */
export const BOARD_SIZE = 4;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Cell values, row-major. 0 is empty. */
export type Board = readonly number[];

export type Direction = 'left' | 'right' | 'up' | 'down';
export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

export const isDirection = (value: unknown): value is Direction =>
  value === 'left' || value === 'right' || value === 'up' || value === 'down';

/** The tile the game is named after — announced once, never an ending (§2). */
export const TARGET_TILE = 2048;

/** A new tile is a 4 this often, a 2 the rest of the time (§5). */
export const SPAWN_FOUR_CHANCE = 0.1;

/**
 * The largest exponent a cell may hold. One base-36 digit per cell is what
 * makes a saved board 16 characters (serialize.ts), and 2^35 is far past
 * anything 16 cells can add up to — so the limit costs no reachable game.
 */
export const MAX_EXPONENT = 35;

export type GameStatus = 'playing' | 'over';

export const rowOf = (index: number): number => Math.floor(index / BOARD_SIZE);
export const colOf = (index: number): number => index % BOARD_SIZE;

export const emptyBoard = (): Board => new Array<number>(CELL_COUNT).fill(0);

/**
 * The power of two a value is, or null when it is not one. Written as a loop
 * rather than `Math.log2` because the answer decides whether a persisted board
 * is loaded or discarded, and a float that rounds the wrong way would let a
 * value onto the board that play could never have produced.
 */
export function exponentOf(value: number): number | null {
  if (!Number.isInteger(value) || value < 2) return null;
  let exponent = 0;
  let remaining = value;
  while (remaining > 1) {
    if (remaining % 2 !== 0) return null;
    remaining /= 2;
    exponent += 1;
  }
  return exponent <= MAX_EXPONENT ? exponent : null;
}

/** A board that could have come from play: 16 cells of empty or 2^n (§1). */
export function isValidBoard(board: Board): boolean {
  if (board.length !== CELL_COUNT) return false;
  for (const value of board) {
    if (value === 0) continue;
    if (exponentOf(value) === null) return false;
  }
  return true;
}

/** The highest number on the board, or 0 while it is empty. */
export function largestTile(board: Board): number {
  let largest = 0;
  for (const value of board) if (value > largest) largest = value;
  return largest;
}
