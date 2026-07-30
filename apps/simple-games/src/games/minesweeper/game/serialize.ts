/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/MINESWEEPER_RULES.md §10).
 *
 * Three bit strings, one character per cell: where the mines are, what is open,
 * what is flagged. The counts are not stored — they are a function of the mine
 * layout, and recomputing 252 of them costs less than the characters would.
 *
 * Decoding fails closed. Anything that does not add up — a wrong length, a
 * character that is not 0 or 1, a mine count that disagrees with the difficulty
 * the record claims, a cell both open and flagged, an opened mine with nothing
 * marked as the mine that ended the game — returns null, and the caller falls
 * back to "no game to resume" rather than to a board that cannot be played
 * (§10: a broken save is discarded, never repaired).
 */
import { fieldFromMines } from './board';
import type { Board } from './engine';
import type { Preset } from './types';

export interface EncodedBoard {
  readonly width: number;
  readonly height: number;
  readonly mines: string;
  readonly opened: string;
  readonly flagged: string;
  /** Index of the mine that ended the game, or null. */
  readonly exploded: number | null;
}

const encodeBits = (bits: readonly boolean[]): string => {
  let out = '';
  for (const bit of bits) out += bit ? '1' : '0';
  return out;
};

const decodeBits = (text: string, length: number): boolean[] | null => {
  if (text.length !== length) return null;
  const bits: boolean[] = [];
  for (const character of text) {
    if (character !== '0' && character !== '1') return null;
    bits.push(character === '1');
  }
  return bits;
};

export function encodeBoard(board: Board): EncodedBoard {
  return {
    width: board.field.width,
    height: board.field.height,
    mines: encodeBits(board.field.mines),
    opened: encodeBits(board.opened),
    flagged: encodeBits(board.flagged),
    exploded: board.exploded,
  };
}

/**
 * Decodes a persisted board, checked against the shape the difficulty promises.
 * Returns null when anything does not add up.
 */
export function decodeBoard(encoded: EncodedBoard, expected: Preset): Board | null {
  if (encoded.width !== expected.width || encoded.height !== expected.height) return null;
  const cells = expected.width * expected.height;

  const mines = decodeBits(encoded.mines, cells);
  const opened = decodeBits(encoded.opened, cells);
  const flagged = decodeBits(encoded.flagged, cells);
  if (mines === null || opened === null || flagged === null) return null;

  let mineCount = 0;
  for (const mine of mines) if (mine) mineCount++;
  if (mineCount !== expected.mines) return null;

  let openedMines = 0;
  for (let i = 0; i < cells; i++) {
    // Play can never produce a cell that is both open and flagged.
    if (opened[i] && flagged[i]) return null;
    if (opened[i] && mines[i]) openedMines++;
  }

  const exploded = encoded.exploded;
  if (exploded !== null) {
    if (!Number.isInteger(exploded) || exploded < 0 || exploded >= cells) return null;
    if (!mines[exploded] || !opened[exploded]) return null;
  } else if (openedMines > 0) {
    // An open mine and a game still running contradict each other.
    return null;
  }

  return {
    field: fieldFromMines(expected.width, expected.height, mines),
    opened,
    flagged,
    exploded,
  };
}
