/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/CHECKERS_RULES.md §8).
 *
 * A cell is stored as its piece — '0' empty, '1' your man, '2' the CPU's,
 * '3' your king, '4' the CPU's — so a whole board is 64 characters. Decoding
 * fails closed: a board that could not have come from play (a stray
 * character, a piece on a light square, an un-crowned man on the far edge, a
 * side already wiped out) is discarded and the player goes back to the home
 * screen rather than into an invented position (§8).
 */
import {
  CELL_COUNT,
  CPU_KING,
  CPU_MAN,
  EMPTY,
  PLAYER_KING,
  PLAYER_MAN,
  isValidBoard,
  type Board,
  type Piece,
} from './types';

export function encodeBoard(board: Board): string {
  return board.join('');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(text: string): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;

  const board: Piece[] = [];
  for (const character of text) {
    if (character === '0') board.push(EMPTY);
    else if (character === '1') board.push(PLAYER_MAN);
    else if (character === '2') board.push(CPU_MAN);
    else if (character === '3') board.push(PLAYER_KING);
    else if (character === '4') board.push(CPU_KING);
    else return null;
  }

  return isValidBoard(board) ? board : null;
}
