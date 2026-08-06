/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/BLOCK_PUZZLE_RULES.md §10).
 *
 * The board is one '0'/'1' per cell — 64 characters, and a cell has nothing
 * else to say (§1). The tray is one base-36 character per slot, since the
 * catalogue's ids stop at 18, with '-' for a slot already spent.
 *
 * Decoding fails closed. A record that does not add up is read as corrupt and
 * dropped, and a new board starts — losing a suspended game is a small cost
 * next to resuming into a board the rules could not have produced (§10).
 */
import { PIECES } from './pieces';
import { CELL_COUNT, TRAY_SIZE, type Board, type Tray } from './types';

/** Marks a slot whose piece has already been placed (§1). */
const EMPTY_SLOT = '-';

export function encodeBoard(board: Board): string {
  return board.map((filled) => (filled ? '1' : '0')).join('');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(text: string): Board | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;
  const board: boolean[] = [];
  for (const character of text) {
    if (character !== '0' && character !== '1') return null;
    board.push(character === '1');
  }
  return board;
}

export function encodeTray(tray: Tray): string {
  return tray.map((id) => (id === null ? EMPTY_SLOT : id.toString(36))).join('');
}

/**
 * Decodes a persisted tray. Null for the wrong length, an unknown piece id, or
 * a fully spent tray — three empty slots is a state the session never saves,
 * because a spent tray refills in the same step that empties it (§1).
 */
export function decodeTray(text: string): Tray | null {
  if (typeof text !== 'string' || text.length !== TRAY_SIZE) return null;
  const tray: (number | null)[] = [];
  for (const character of text) {
    if (character === EMPTY_SLOT) {
      tray.push(null);
      continue;
    }
    const id = parseInt(character, 36);
    if (!Number.isInteger(id) || id < 0 || id >= PIECES.length) return null;
    tray.push(id);
  }
  return tray.every((id) => id === null) ? null : tray;
}
