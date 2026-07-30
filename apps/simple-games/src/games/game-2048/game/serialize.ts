/**
 * Compact, corruption-tolerant board serialization for local persistence.
 *
 * Every tile is a power of two, so only the exponent is stored: one base-36
 * character per square, '0' for empty and '1'..'h' for 2..131072. Sixteen
 * characters hold a whole board. (There is no "1" tile, so exponent 0 is free
 * to mean empty.)
 *
 * Decoding fails closed: anything malformed returns null and the caller falls
 * back to "no game to resume" rather than to a board that never existed. A
 * value above the 4x4 ceiling (§7) is treated as corruption, not as data —
 * play cannot produce one.
 */
import { CELLS, MAX_EXPONENT, type Board } from './types';

const RADIX = 36;

/** The base-2 exponent of a tile value, or null when it is not a tile. */
function exponentOf(value: number): number | null {
  if (value === 0) return 0;
  if (!Number.isInteger(value) || value < 2) return null;
  const exponent = Math.log2(value);
  if (!Number.isInteger(exponent) || exponent > MAX_EXPONENT) return null;
  return exponent;
}

export function encodeBoard(board: Board): string {
  let out = '';
  for (let i = 0; i < CELLS; i++) {
    // A board that cannot be expressed is a bug, not a save: store it as empty
    // rather than write a string that will not decode.
    out += (exponentOf(board[i] ?? 0) ?? 0).toString(RADIX);
  }
  return out;
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeBoard(text: string): Board | null {
  if (typeof text !== 'string' || text.length !== CELLS) return null;
  const board: number[] = [];
  for (const character of text) {
    // parseInt would happily read '1x' or ignore trailing junk; one character
    // at a time, with an explicit range check, leaves it nothing to guess at.
    const exponent = parseInt(character, RADIX);
    if (!Number.isInteger(exponent) || exponent < 0 || exponent > MAX_EXPONENT) return null;
    board.push(exponent === 0 ? 0 : 2 ** exponent);
  }
  return board;
}
