/**
 * The piece catalogue and the refill draw (docs/BLOCK_PUZZLE_RULES.md §6).
 *
 * Nineteen fixed shapes, and no rotation: where a piece goes is the only
 * choice the game offers, and that is what makes a board tighten (§1, §13).
 * Every shape is normalized to touch row 0 and column 0, so an offset list is
 * the shape itself rather than the shape plus an arbitrary origin.
 *
 * THE ORDER BELOW IS A COMPATIBILITY CONTRACT. A saved game stores the ids of
 * the pieces in the tray (§10) and the golden test pins the ids a seed draws
 * (compatibility.test.ts), so inserting a shape anywhere but the end would
 * silently deal a player a different piece than the one they suspended — and
 * would re-deal every board a seed has ever produced. Append only.
 *
 * The draw is uniform and does NOT look at the board (§6): no shape is chosen
 * because it fits, and none because it does not. That is what makes "none of
 * these three fit" an honest ending rather than a scripted one (§2).
 */
import { createRng } from './rng';
import { TRAY_SIZE } from './types';

/** A cell of a shape, relative to the shape's own top-left corner. */
export interface Offset {
  readonly row: number;
  readonly col: number;
}

export interface Piece {
  readonly id: number;
  /** Row-major, first cell first — the anchor the tap path places on (§3). */
  readonly cells: readonly Offset[];
  readonly width: number;
  readonly height: number;
}

/** Builds a piece from its offsets, deriving the box it occupies. */
function piece(id: number, cells: readonly [number, number][]): Piece {
  let width = 0;
  let height = 0;
  for (const [row, col] of cells) {
    if (row + 1 > height) height = row + 1;
    if (col + 1 > width) width = col + 1;
  }
  return { id, cells: cells.map(([row, col]) => ({ row, col })), width, height };
}

/** Bars, squares, and the two corner families. Nineteen shapes, in order. */
export const PIECES: readonly Piece[] = [
  // Single square.
  piece(0, [[0, 0]]),
  // Bars, alternating lying down and standing up.
  piece(1, [
    [0, 0],
    [0, 1],
  ]),
  piece(2, [
    [0, 0],
    [1, 0],
  ]),
  piece(3, [
    [0, 0],
    [0, 1],
    [0, 2],
  ]),
  piece(4, [
    [0, 0],
    [1, 0],
    [2, 0],
  ]),
  piece(5, [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
  ]),
  piece(6, [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]),
  piece(7, [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ]),
  piece(8, [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ]),
  // Solid squares.
  piece(9, [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ]),
  piece(10, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ]),
  // The four corners of a 2×2 — three cells, one square missing. Listed by
  // where the corner itself sits: top-left, top-right, bottom-right, bottom-left.
  piece(11, [
    [0, 0],
    [0, 1],
    [1, 0],
  ]),
  piece(12, [
    [0, 0],
    [0, 1],
    [1, 1],
  ]),
  piece(13, [
    [0, 1],
    [1, 0],
    [1, 1],
  ]),
  piece(14, [
    [0, 0],
    [1, 0],
    [1, 1],
  ]),
  // The four corners of a 3×3 — five cells, two arms of three. Same order.
  piece(15, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [2, 0],
  ]),
  piece(16, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
    [2, 2],
  ]),
  piece(17, [
    [0, 2],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ]),
  piece(18, [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ]),
];

/** The piece with this id, or null for an id no catalogue entry carries. */
export function pieceById(id: number | null | undefined): Piece | null {
  if (typeof id !== 'number' || !Number.isInteger(id)) return null;
  return PIECES[id] ?? null;
}

/**
 * The three pieces of one refill (§6). Deterministic per (seed, batchIndex),
 * which is what lets undo put the tray back without re-drawing it (§7) and
 * lets a saved game come back holding the pieces it was suspended with (§10).
 */
export function drawBatch(seed: string, batchIndex: number): readonly number[] {
  const rng = createRng(`${seed}:${batchIndex}`);
  const ids: number[] = [];
  for (let slot = 0; slot < TRAY_SIZE; slot++) {
    ids.push(PIECES[Math.floor(rng() * PIECES.length)]!.id);
  }
  return ids;
}
