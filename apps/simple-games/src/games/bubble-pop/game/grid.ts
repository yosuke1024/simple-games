/**
 * Hex-offset grid geometry (docs/BUBBLE_POP_RULES.md §1). Rows are horizontal
 * bands of tangent circles; odd rows are indented by half a cell so each
 * circle sits in the notch between two circles of the row above — the
 * classic offset packing, not axial hex coordinates, because the board is a
 * fixed set of horizontal bands and never needs to address a hex outside
 * that band structure.
 *
 * Even rows hold COLUMNS circles (col 0..COLUMNS-1); odd rows are indented by
 * one radius on each side and so hold one fewer (col 0..COLUMNS-2). This file
 * is pure geometry — it knows nothing about what is a bubble, a color, or a
 * board; engine.ts and generator.ts build on top of it.
 */
import { CELL_DIAMETER, CELL_RADIUS, COLUMNS, GRID_TOP, ROW_HEIGHT } from './constants';
import type { Cell, Point } from './types';

/** Column count for a row, given its parity. */
export function colsForRow(row: number): number {
  return row % 2 === 0 ? COLUMNS : COLUMNS - 1;
}

export function isValidCell(cell: Cell): boolean {
  return cell.row >= 0 && cell.col >= 0 && cell.col < colsForRow(cell.row);
}

export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

export function cellFromKey(key: string): Cell {
  const [row, col] = key.split(',').map(Number);
  return { row: row!, col: col! };
}

/** The cell's center in board pixel space, ignoring any ceiling descent. */
export function cellCenter(cell: Cell): Point {
  const y = GRID_TOP + cell.row * ROW_HEIGHT;
  const x =
    cell.row % 2 === 0
      ? CELL_RADIUS + cell.col * CELL_DIAMETER
      : CELL_RADIUS + CELL_DIAMETER * (cell.col + 0.5);
  return { x, y };
}

/** The cell's on-screen center once the ceiling has crept down `ceilingOffset` rows. */
export function effectiveCenter(cell: Cell, ceilingOffset: number): Point {
  const { x, y } = cellCenter(cell);
  return { x, y: y + ceilingOffset * ROW_HEIGHT };
}

/**
 * The up to 6 grid-adjacent cells, filtered to ones that exist. Which columns
 * neighbor which depends on row parity — see the file comment.
 */
export function neighborsOf(cell: Cell): Cell[] {
  const { row, col } = cell;
  const evenAbove = row % 2 === 0;
  const candidates: Cell[] = [
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col: evenAbove ? col - 1 : col },
    { row: row - 1, col: evenAbove ? col : col + 1 },
    { row: row + 1, col: evenAbove ? col - 1 : col },
    { row: row + 1, col: evenAbove ? col : col + 1 },
  ];
  return candidates.filter(isValidCell);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function allCellsInRow(row: number): Cell[] {
  const count = colsForRow(row);
  return Array.from({ length: count }, (_, col) => ({ row, col }));
}
