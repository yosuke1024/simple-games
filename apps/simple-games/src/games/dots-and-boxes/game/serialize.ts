/**
 * Corruption-tolerant board decoding for local persistence
 * (docs/DOTS_AND_BOXES_RULES.md §8).
 *
 * The board already is two strings (§1), so encoding is the identity; what
 * this module owns is the other direction. Decoding fails closed: a board
 * that could not have come from play — a length the size does not have, a
 * stray character, a closed box with no owner or an owner on an open one —
 * is discarded, and the player goes back to the home screen rather than into
 * an invented position (§8).
 */
import { isConsistent } from './engine';
import { BOXES_FOR, isBoardSize, type Board, type BoardSize } from './types';

/**
 * Decodes a persisted board for `size`. Returns null when anything does not
 * add up (§8).
 */
export function decodeBoard(size: BoardSize, edges: unknown, boxes: unknown): Board | null {
  if (!isBoardSize(size) || typeof edges !== 'string' || typeof boxes !== 'string') return null;
  const board: Board = { n: BOXES_FOR[size], edges, boxes };
  return isConsistent(board) ? board : null;
}
