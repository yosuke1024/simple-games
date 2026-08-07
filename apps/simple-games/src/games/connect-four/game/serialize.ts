/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/CONNECT_FOUR_RULES.md §8).
 *
 * A cell is stored as its piece — '0' empty, '1' the player, '2' the CPU —
 * so a whole board is 42 characters, row 0 (the top) first. Decoding fails
 * closed: a board that could not have come from play (a stray character, a
 * floating disc, counts the alternation cannot reach) is discarded and the
 * player goes back to the home screen rather than into an invented position
 * (§8).
 */
import {
  CELL_COUNT,
  CPU,
  EMPTY,
  isValidBoard,
  PLAYER,
  type Board,
  type Piece,
  type Side,
} from './types';

export function encodeBoard(board: Board): string {
  return board.join('');
}

/**
 * Decodes a persisted board. Returns null when anything does not add up —
 * which includes disc counts the saved opener could not have produced (§8).
 */
export function decodeBoard(text: string, first: Side): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;

  const board: Piece[] = [];
  for (const character of text) {
    if (character === '0') board.push(EMPTY);
    else if (character === '1') board.push(PLAYER);
    else if (character === '2') board.push(CPU);
    else return null;
  }

  return isValidBoard(board, first) ? board : null;
}
