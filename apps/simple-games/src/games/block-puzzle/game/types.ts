/**
 * Core Block Puzzle types. See docs/BLOCK_PUZZLE_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A board is 8×8 booleans, row-major, and a cell has exactly two states: empty
 * or filled (§1). No colours, no numbers, no per-cell history — the whole game
 * state a player has to read is "which squares are taken", and anything richer
 * stored here would be something the board does not show.
 */

export const BOARD_SIZE = 8;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** Filled flag per cell, row-major, always CELL_COUNT long (§1). */
export type Board = readonly boolean[];

/** The three slots on offer; a used slot holds null until the batch refills (§1). */
export const TRAY_SIZE = 3;
export type Tray = readonly (number | null)[];

export type GameStatus = 'playing' | 'over';

export const emptyBoard = (): Board => new Array<boolean>(CELL_COUNT).fill(false);

export const indexAt = (row: number, col: number): number => row * BOARD_SIZE + col;
export const rowOf = (index: number): number => Math.floor(index / BOARD_SIZE);
export const colOf = (index: number): number => index % BOARD_SIZE;

export const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

/** A board that could have come from play: the right size, and only booleans. */
export function isValidBoard(board: unknown): board is Board {
  if (!Array.isArray(board) || board.length !== CELL_COUNT) return false;
  for (const cell of board) if (typeof cell !== 'boolean') return false;
  return true;
}
