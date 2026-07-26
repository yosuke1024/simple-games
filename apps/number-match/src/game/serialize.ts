/**
 * Compact, corruption-tolerant board serialization for local persistence.
 * values: one digit per cell ("34129…"), mask: '1' = cleared, '0' = live.
 */
import type { Board, Cell, Digit } from './types';

export interface EncodedBoard {
  readonly values: string;
  readonly mask: string;
}

export function encodeBoard(board: Board): EncodedBoard {
  let values = '';
  let mask = '';
  for (const cell of board) {
    values += String(cell.value);
    mask += cell.cleared ? '1' : '0';
  }
  return { values, mask };
}

/** Returns null when the encoded data is malformed (never throws). */
export function decodeBoard(encoded: unknown): Board | null {
  if (typeof encoded !== 'object' || encoded === null) return null;
  const { values, mask } = encoded as { values?: unknown; mask?: unknown };
  if (typeof values !== 'string' || typeof mask !== 'string') return null;
  if (values.length !== mask.length) return null;
  const cells: Cell[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = Number(values[i]);
    const clearedChar = mask[i];
    if (!Number.isInteger(value) || value < 1 || value > 9) return null;
    if (clearedChar !== '0' && clearedChar !== '1') return null;
    cells.push({ value: value as Digit, cleared: clearedChar === '1' });
  }
  return cells;
}
