/**
 * Where each hole is drawn, and where the arrow keys take the focus
 * (docs/PEG_SOLITAIRE_RULES.md §4, §13). Screen geometry only — the rules
 * never read it; which three holes make a line is game/boards.ts's alone.
 *
 * Everything is measured in pitches (the distance between two neighbouring
 * holes), so a hole is always one pitch across and a board's aspect ratio is
 * its width over its height:
 * - English: the 7×7 grid the cross is cut from, a hole at (col + ½, row + ½).
 * - Triangle: rows √3⁄2 apart, each row centred, so every hole is exactly one
 *   pitch from each of its six neighbours — the triangle's three lines are
 *   straight on screen as well as in the rules.
 */
import type { BoardGeometry } from '../game';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface BoardLayout {
  /** Width and height of the board in pitches. */
  readonly width: number;
  readonly height: number;
  /** Each hole's centre, in hole order. */
  readonly centers: readonly Point[];
  /**
   * The outline the plate is drawn around: the outermost hole centres in
   * order. A stroke one pitch wide along it, with round joins, covers every
   * hole exactly — the board's shape without a single extra corner.
   */
  readonly outline: readonly Point[];
}

const ROW_STEP = Math.sqrt(3) / 2;

function englishLayout(geometry: BoardGeometry): BoardLayout {
  const point = (x: number, y: number): Point => ({ x, y });
  return {
    width: geometry.cols,
    height: geometry.rows,
    centers: geometry.holes.map((hole) => point(hole.col + 0.5, hole.row + 0.5)),
    outline: [
      point(2.5, 0.5),
      point(4.5, 0.5),
      point(4.5, 2.5),
      point(6.5, 2.5),
      point(6.5, 4.5),
      point(4.5, 4.5),
      point(4.5, 6.5),
      point(2.5, 6.5),
      point(2.5, 4.5),
      point(0.5, 4.5),
      point(0.5, 2.5),
      point(2.5, 2.5),
    ],
  };
}

function triangleLayout(geometry: BoardGeometry): BoardLayout {
  const rows = geometry.rows;
  const center = (row: number, col: number): Point => ({
    x: col - row / 2 + rows / 2,
    y: row * ROW_STEP + 0.5,
  });
  return {
    width: rows,
    height: (rows - 1) * ROW_STEP + 1,
    centers: geometry.holes.map((hole) => center(hole.row, hole.col)),
    outline: [center(0, 0), center(rows - 1, rows - 1), center(rows - 1, 0)],
  };
}

const cache = new Map<BoardGeometry, BoardLayout>();

export function layoutOf(geometry: BoardGeometry): BoardLayout {
  let layout = cache.get(geometry);
  if (!layout) {
    layout = geometry.kind === 'english' ? englishLayout(geometry) : triangleLayout(geometry);
    cache.set(geometry, layout);
  }
  return layout;
}

/**
 * The hole under a point given in pitches, or −1 when the point is between
 * holes or off the board. A hole's target is the disc of half a pitch around
 * its centre — the same disc the button draws — so neighbouring targets touch
 * and never overlap.
 */
export function holeAt(layout: BoardLayout, x: number, y: number): number {
  let best = -1;
  let bestDistance = 0.5 * 0.5;
  layout.centers.forEach((center, index) => {
    const dx = center.x - x;
    const dy = center.y - y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

export const isArrowKey = (key: string): key is ArrowKey =>
  key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight';

/**
 * Where an arrow key moves the focus from `index` (§4), or `index` itself at
 * an edge — the focus stops rather than wrapping.
 *
 * - English: one hole in the arrow's direction, when that spot is a hole.
 * - Triangle: ←/→ move along the row. ↑/↓ move to the adjacent row, where two
 *   holes touch this one diagonally and are equally near; the one taken is
 *   the hole with the same place in its row (so ↓ then ↑ comes back), or —
 *   for the last hole of a row, which has no such hole above — the one beside
 *   it.
 */
export function stepFocus(geometry: BoardGeometry, index: number, key: ArrowKey): number {
  const hole = geometry.holes[index];
  if (!hole) return index;
  const find = (row: number, col: number): number => {
    const found = geometry.holes.findIndex((h) => h.row === row && h.col === col);
    return found < 0 ? index : found;
  };
  const { row, col } = hole;
  if (geometry.kind === 'english') {
    if (key === 'ArrowUp') return find(row - 1, col);
    if (key === 'ArrowDown') return find(row + 1, col);
    if (key === 'ArrowLeft') return find(row, col - 1);
    return find(row, col + 1);
  }
  if (key === 'ArrowLeft') return find(row, col - 1);
  if (key === 'ArrowRight') return find(row, col + 1);
  if (key === 'ArrowUp') return row === 0 ? index : find(row - 1, Math.min(col, row - 1));
  return find(row + 1, col);
}
