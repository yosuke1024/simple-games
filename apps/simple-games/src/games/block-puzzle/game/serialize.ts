/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/BLOCK_PUZZLE_RULES.md §10).
 *
 * The board is one digit per cell — 64 characters. In the first save format
 * (v1) the alphabet was '0'/'1', because a cell had nothing else to say (§1);
 * that is `encodeBoard` / `decodeBoard`, kept as they were because a v1 record
 * is still read through them and the golden test reads the board through
 * `encodeBoard`. Since v2 a filled cell is written as its tone, '1'–'9', and
 * '0' is still empty (`encodeCells` / `decodeCells`, §10). A v1 board reads as
 * itself under the wider alphabet: its '1' is tone 1, the accent every filled
 * square was drawn in. The tray is one base-36 character per slot, since the
 * catalogue's ids stop at 18, with '-' for a slot already spent.
 *
 * Decoding fails closed. A record that does not add up is read as corrupt and
 * dropped, and a new board starts — losing a suspended game is a small cost
 * next to resuming into a board the rules could not have produced (§10).
 */
import { PIECES } from './pieces';
import { LEGACY_TONE } from './tones';
import { CELL_COUNT, TRAY_SIZE, type Board, type Tones, type Tray } from './types';

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

/** The highest tone a saved cell can carry: one decimal digit (§10). */
const MAX_SAVED_TONE = 9;

/**
 * The saved board (v2, §10): '0' for an empty cell, the tone '1'–'9' for a
 * filled one. Only filled cells say their tone — the paint left under an empty
 * cell is for a fade in progress, not part of the position. A filled cell
 * whose tone cannot be one digit is written as the accent.
 */
export function encodeCells(board: Board, tones: Tones): string {
  return board
    .map((filled, index) => {
      if (!filled) return '0';
      const tone = tones[index];
      return typeof tone === 'number' &&
        Number.isInteger(tone) &&
        tone >= LEGACY_TONE &&
        tone <= MAX_SAVED_TONE
        ? String(tone)
        : String(LEGACY_TONE);
    })
    .join('');
}

/**
 * Decodes a saved board in either alphabet. Every digit is accepted — a tone
 * this build does not paint is drawn in the accent, so a newer build's colours
 * never cost a player their board — and anything that is not a digit fails
 * closed, like `decodeBoard`.
 */
export function decodeCells(text: string): { readonly board: Board; readonly tones: Tones } | null {
  if (typeof text !== 'string' || text.length !== CELL_COUNT) return null;
  const board: boolean[] = [];
  const tones: number[] = [];
  for (const character of text) {
    if (character < '0' || character > '9') return null;
    const tone = character.charCodeAt(0) - 48;
    board.push(tone !== 0);
    tones.push(tone);
  }
  return { board, tones };
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
