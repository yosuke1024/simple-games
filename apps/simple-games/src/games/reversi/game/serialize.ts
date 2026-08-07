/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/REVERSI_RULES.md §9).
 *
 * A cell is stored as its piece — '0' empty, '1' black, '2' white — so a
 * whole board is 64 characters. Decoding fails closed: a board that could not
 * have come from play (a stray character, an empty centre, fewer discs than
 * the opening) is discarded and the player goes back to the home screen
 * rather than into an invented position (§9).
 */
import { BLACK, CELL_COUNT, EMPTY, isValidBoard, WHITE, type Board, type Piece } from './types';

export function encodeBoard(board: Board): string {
  return board.join('');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(text: string): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;

  const board: Piece[] = [];
  for (const character of text) {
    if (character === '0') board.push(EMPTY);
    else if (character === '1') board.push(BLACK);
    else if (character === '2') board.push(WHITE);
    else return null;
  }

  return isValidBoard(board) ? board : null;
}
