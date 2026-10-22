/**
 * Core Gem Swap types and constants. docs/GEM_SWAP_RULES.md is the single
 * source of truth for the rules these shapes serve; the § numbers below point
 * into it.
 *
 * A board is 64 kinds, row-major (index = row * 8 + col, row 0 at the top).
 * A kind is an integer 0..colors-1 (§1); the shape and colour each kind is
 * drawn with are game content defined in gems.ts and the stylesheet, never
 * here. During a resolution a cell can be momentarily empty (EMPTY) — no
 * board handed to or returned from the public functions ever holds one.
 */

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Horizontally plus vertically adjacent pairs: 8 × 7 + 8 × 7 (§1). */
export const ADJACENT_PAIR_COUNT = 2 * BOARD_SIZE * (BOARD_SIZE - 1);

/** A round is this many valid swaps, unless it gets stuck first (§1, §5). */
export const ROUND_SWAPS = 30;

/** Initial-board draws before the bundled board takes over (§4.1). */
export const INITIAL_ATTEMPT_LIMIT = 64;

/** Cascade stages one move may resolve before it stops honestly (§4.4). */
export const CASCADE_STAGE_LIMIT = 64;

/** Easy = 5 kinds, Normal (the default) = 6 kinds (§2). */
export type ColorCount = 5 | 6;
export const COLOR_COUNTS: readonly ColorCount[] = [5, 6];
export const DEFAULT_COLOR_COUNT: ColorCount = 6;

export const isColorCount = (value: unknown): value is ColorCount => value === 5 || value === 6;

/** Kinds per cell, row-major, always CELL_COUNT long. */
export type Board = readonly number[];

/** A cell emptied by a clear and not yet refilled (internal to resolution). */
export const EMPTY = -1;

/** Two cell indices, normalised so that a < b (§7). */
export type Swap = readonly [number, number];

/** How many gems each column has drawn from its refill tape so far (§4.2). */
export type Tape = readonly number[];

export const indexAt = (row: number, col: number): number => row * BOARD_SIZE + col;
export const rowOf = (index: number): number => Math.floor(index / BOARD_SIZE);
export const colOf = (index: number): number => index % BOARD_SIZE;

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

export const isCellIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CELL_COUNT;

/** Up/down/left/right neighbours only — the only swaps the rules allow (§1). */
export function isAdjacent(a: number, b: number): boolean {
  if (!isCellIndex(a) || !isCellIndex(b)) return false;
  const dr = Math.abs(rowOf(a) - rowOf(b));
  const dc = Math.abs(colOf(a) - colOf(b));
  return dr + dc === 1;
}

/** The canonical form of a swap: the smaller index first (§7). */
export const normaliseSwap = (a: number, b: number): Swap => (a < b ? [a, b] : [b, a]);

/** A full, settled-or-not board of known kinds: right length, integers in range. */
export function isValidBoard(board: unknown, colors: ColorCount): board is Board {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) return false;
  for (const cell of board) {
    if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= colors) {
      return false;
    }
  }
  return true;
}

export const freshTape = (): Tape => new Array<number>(BOARD_SIZE).fill(0);
