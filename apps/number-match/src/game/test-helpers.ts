/**
 * Test fixture helper: builds a board from row strings.
 *
 *   digit → a live number
 *   '*'   → a live wild (pairs with anything)
 *   'S'   → a stone (never matchable, opaque to connections)
 *   '.'   → a cleared cell
 *   '#'   → a hole in the shape (absent slot)
 *
 * Every row occupies COLS slots; rows shorter than COLS are padded with holes,
 * which is exactly how a real board's last row looks.
 */
import { COLS } from './constants';
import { isDigit, type Board, type BoardCell, type Digit } from './types';

export function makeBoard(...rows: string[]): Board {
  const cells: BoardCell[] = [];
  rows.forEach((row, index) => {
    if (row.length > COLS) {
      throw new Error(`Fixture row ${index} has ${row.length} cells, max ${COLS}`);
    }
    for (const ch of row) {
      if (ch === '.') {
        cells.push({ kind: 'digit', value: 1, cleared: true });
      } else if (ch === '#') {
        cells.push(null);
      } else if (ch === '*') {
        cells.push({ kind: 'wild', cleared: false });
      } else if (ch === 'S') {
        cells.push({ kind: 'stone' });
      } else {
        const value = Number(ch);
        if (!Number.isInteger(value) || value < 1 || value > 9) {
          throw new Error(`Invalid fixture char: ${ch}`);
        }
        cells.push({ kind: 'digit', value: value as Digit, cleared: false });
      }
    }
    for (let pad = row.length; pad < COLS; pad++) cells.push(null);
  });
  return cells;
}

/** Live numbers in reading order — handy for asserting on Add Numbers. */
export function liveValues(board: Board): number[] {
  return board.filter(isDigit).map((c) => c.value);
}
