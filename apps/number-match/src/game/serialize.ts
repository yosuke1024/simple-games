/**
 * Compact, corruption-tolerant board serialization for local persistence.
 *
 * values: one character per slot — '1'..'9' for a number, '0' for a hole.
 * mask:   '1' = cleared, '0' = live (ignored for holes).
 */
import type { Board, BoardCell, Digit } from './types';

export interface EncodedBoard {
  readonly values: string;
  readonly mask: string;
}

export function encodeBoard(board: Board): EncodedBoard {
  let values = '';
  let mask = '';
  for (const cell of board) {
    if (cell === null) {
      values += '0';
      mask += '0';
    } else {
      values += String(cell.value);
      mask += cell.cleared ? '1' : '0';
    }
  }
  return { values, mask };
}

/** Returns null when the encoded data is malformed (never throws). */
export function decodeBoard(encoded: unknown): Board | null {
  if (typeof encoded !== 'object' || encoded === null) return null;
  const { values, mask } = encoded as { values?: unknown; mask?: unknown };
  if (typeof values !== 'string' || typeof mask !== 'string') return null;
  if (values.length !== mask.length) return null;
  const cells: BoardCell[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    const clearedChar = mask[i];
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
    if (clearedChar !== '0' && clearedChar !== '1') return null;
    if (value === 0) {
      // A hole must not also claim to be cleared.
      if (clearedChar !== '0') return null;
      cells.push(null);
    } else {
      cells.push({ value: value as Digit, cleared: clearedChar === '1' });
    }
  }
  return cells;
}
