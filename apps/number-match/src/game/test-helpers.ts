/**
 * Test fixture helper: builds a board from row strings.
 * Digits become live cells; '.' becomes a cleared cell (value 1).
 * Every row except the last must be exactly COLS (9) characters.
 */
import { COLS } from './constants';
import type { Board, Cell, Digit } from './types';

export function makeBoard(...rows: string[]): Board {
  const cells: Cell[] = [];
  rows.forEach((row, index) => {
    if (index < rows.length - 1 && row.length !== COLS) {
      throw new Error(`Fixture row ${index} must have exactly ${COLS} cells, got ${row.length}`);
    }
    for (const ch of row) {
      if (ch === '.') {
        cells.push({ value: 1, cleared: true });
      } else {
        const value = Number(ch);
        if (!Number.isInteger(value) || value < 1 || value > 9) {
          throw new Error(`Invalid fixture char: ${ch}`);
        }
        cells.push({ value: value as Digit, cleared: false });
      }
    }
  });
  return cells;
}
