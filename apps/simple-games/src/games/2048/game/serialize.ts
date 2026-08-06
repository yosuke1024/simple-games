/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/GAME_2048_RULES.md §10).
 *
 * A cell is stored as its exponent in base 36 — '0' for empty, 'b' for 2048 —
 * so a whole board is 16 characters no matter how far the game has run. The
 * value itself would need five digits and a separator; the exponent needs one
 * character and cannot express a number that is not a power of two.
 *
 * Decoding fails closed: a board that could not have come from play is
 * discarded and a new one is dealt (§10). That includes the empty board, which
 * is not a game in progress — every session starts with two tiles (§5).
 */
import { CELL_COUNT, exponentOf, isValidBoard, MAX_EXPONENT, type Board } from './types';

export function encodeBoard(board: Board): string {
  return board.map((value) => (exponentOf(value) ?? 0).toString(36)).join('');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(text: string): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;

  const board: number[] = [];
  for (const character of text) {
    const exponent = parseInt(character, 36);
    if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_EXPONENT) return null;
    // Exponent 1 is the smallest tile; 0 is the empty cell, and there is no
    // tile worth 1 for it to be confused with.
    board.push(exponent === 0 ? 0 : 2 ** exponent);
  }

  if (!isValidBoard(board)) return null;
  return board.some((value) => value !== 0) ? board : null;
}
