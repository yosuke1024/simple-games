/**
 * The one reading of "a legal region" (docs/BOX_REGIONS_RULES.md §1–§3):
 * an axis-aligned, filled rectangle of area 1–12, whose kind (§2) is read
 * from its width and height. The win (engine.ts), the violation display (§5),
 * the candidate placements (placements.ts), the save check (serialize.ts) and
 * the generator all ask this file, so none of them can read a box differently.
 */
import { MAX_REGION_SIZE, MIN_REGION_SIZE, colOf, rowOf, type Clue, type ShapeKind } from './types';

export interface Rect {
  readonly top: number;
  readonly left: number;
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
}

export const rectArea = (rect: Rect): number => rect.width * rect.height;

/** square when w = h, tall when h > w, wide when w > h (§2). Never `free`. */
export function kindOf(width: number, height: number): Exclude<ShapeKind, 'free'> {
  if (width === height) return 'square';
  return height > width ? 'tall' : 'wide';
}

/** The rectangle two cells span as opposite corners (§4). */
export function spanRect(a: number, b: number, boardWidth: number): Rect {
  const top = Math.min(rowOf(a, boardWidth), rowOf(b, boardWidth));
  const bottom = Math.max(rowOf(a, boardWidth), rowOf(b, boardWidth));
  const left = Math.min(colOf(a, boardWidth), colOf(b, boardWidth));
  const right = Math.max(colOf(a, boardWidth), colOf(b, boardWidth));
  return { top, left, width: right - left + 1, height: bottom - top + 1 };
}

/** The cells of a rectangle, ascending (row-major). */
export function rectCells(rect: Rect, boardWidth: number): number[] {
  const out: number[] = [];
  for (let r = rect.top; r < rect.top + rect.height; r++) {
    for (let c = rect.left; c < rect.left + rect.width; c++) out.push(r * boardWidth + c);
  }
  return out;
}

export const rectContains = (rect: Rect, index: number, boardWidth: number): boolean => {
  const r = rowOf(index, boardWidth);
  const c = colOf(index, boardWidth);
  return (
    r >= rect.top && r < rect.top + rect.height && c >= rect.left && c < rect.left + rect.width
  );
};

/**
 * The rectangle a set of cells fills exactly, or null when the cells are not
 * one filled rectangle (empty, holed, or ragged).
 */
export function rectOfCells(cells: readonly number[], boardWidth: number): Rect | null {
  if (cells.length === 0) return null;
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  const seen = new Set<number>();
  for (const cell of cells) {
    seen.add(cell);
    const r = rowOf(cell, boardWidth);
    const c = colOf(cell, boardWidth);
    if (r < top) top = r;
    if (r > bottom) bottom = r;
    if (c < left) left = c;
    if (c > right) right = c;
  }
  const rect: Rect = { top, left, width: right - left + 1, height: bottom - top + 1 };
  if (seen.size !== cells.length || rectArea(rect) !== cells.length) return null;
  return rect;
}

/** Whether a rectangle's area and kind answer to a clue (§3, rules 3–4). */
export function rectSatisfiesClue(rect: Rect, clue: Clue): boolean {
  const area = rectArea(rect);
  if (area < MIN_REGION_SIZE || area > MAX_REGION_SIZE) return false;
  if (clue.size !== null && area !== clue.size) return false;
  if (clue.kind !== 'free' && kindOf(rect.width, rect.height) !== clue.kind) return false;
  return true;
}
