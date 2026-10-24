/**
 * The two boards' shapes (docs/PEG_SOLITAIRE_RULES.md §1, §2): which holes
 * exist, and along which lines a peg may jump. Everything else — the rules
 * engine, the solver, the session — reads the board from here, so there is
 * one definition of "a legal line", not one per caller.
 *
 * The directions are the whole difference between the boards (§2):
 * - the cross jumps along its grid: up, right, down, left — never diagonally;
 * - the triangle jumps along its three lines (six directions). In the row /
 *   place-in-row coordinates used here those are (0, ±1), (±1, 0) and
 *   (±1, ±1) with the same sign. (1, −1) and (−1, 1) are not lines of the
 *   triangle, and neither is straight down the screen, (2, 1): the engine
 *   test pins all three as illegal.
 *
 * The jump table is every (from, over, to) whose three holes all exist,
 * listed by `from` in hole order and then by direction in the order below.
 * The solver searches in exactly this order, so it is part of what makes its
 * answers reproducible.
 */
import type { BoardKind, Hole, Jump } from './types';

/** A step along one line: rows down, columns right. */
export type Direction = readonly [dRow: number, dCol: number];

/** The cross: up, right, down, left. No diagonals (§2). */
export const ENGLISH_DIRECTIONS: readonly Direction[] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

/**
 * The triangle's six: up-left, up-right (in screen terms), right, down-right,
 * down-left, left. In row / place-in-row terms: (−1, −1), (−1, 0), (0, 1),
 * (1, 1), (1, 0), (0, −1).
 */
export const TRIANGLE_DIRECTIONS: readonly Direction[] = [
  [-1, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
  [1, 0],
  [0, -1],
];

export interface BoardGeometry {
  readonly kind: BoardKind;
  /** Every hole, in the order positions and saves index them. */
  readonly holes: readonly Hole[];
  readonly directions: readonly Direction[];
  /** Every geometrically possible jump, in search order (see above). */
  readonly jumps: readonly Jump[];
  /** Rows on screen: 7 for the cross, 5 for the triangle. */
  readonly rows: number;
  /** Columns of the grid the cross is cut from; the triangle's longest row. */
  readonly cols: number;
}

export const ENGLISH_SIZE = 7;
export const TRIANGLE_ROWS = 5;

function englishHoles(): Hole[] {
  const holes: Hole[] = [];
  for (let row = 0; row < ENGLISH_SIZE; row++) {
    for (let col = 0; col < ENGLISH_SIZE; col++) {
      // The cross: the middle three rows run the full width; the others only
      // the middle three columns. The four 2×2 corners are not holes.
      const inArm = (row >= 2 && row <= 4) || (col >= 2 && col <= 4);
      if (inArm) holes.push({ row, col });
    }
  }
  return holes;
}

function triangleHoles(): Hole[] {
  const holes: Hole[] = [];
  for (let row = 0; row < TRIANGLE_ROWS; row++) {
    for (let col = 0; col <= row; col++) holes.push({ row, col });
  }
  return holes;
}

function buildGeometry(
  kind: BoardKind,
  holes: readonly Hole[],
  directions: readonly Direction[],
  rows: number,
  cols: number,
): BoardGeometry {
  const index = new Map<string, number>();
  holes.forEach((hole, i) => index.set(`${hole.row},${hole.col}`, i));
  const at = (row: number, col: number) => index.get(`${row},${col}`);
  const jumps: Jump[] = [];
  holes.forEach((hole, from) => {
    for (const [dRow, dCol] of directions) {
      const over = at(hole.row + dRow, hole.col + dCol);
      const to = at(hole.row + 2 * dRow, hole.col + 2 * dCol);
      if (over !== undefined && to !== undefined) jumps.push({ from, over, to });
    }
  });
  return { kind, holes, directions, jumps, rows, cols };
}

export const ENGLISH: BoardGeometry = buildGeometry(
  'english',
  englishHoles(),
  ENGLISH_DIRECTIONS,
  ENGLISH_SIZE,
  ENGLISH_SIZE,
);

export const TRIANGLE: BoardGeometry = buildGeometry(
  'triangle',
  triangleHoles(),
  TRIANGLE_DIRECTIONS,
  TRIANGLE_ROWS,
  TRIANGLE_ROWS,
);

/** 33 holes on the cross, 15 on the triangle (§1). */
export const ENGLISH_HOLE_COUNT = 33;
export const TRIANGLE_HOLE_COUNT = 15;

/** The cross's middle hole, (3, 3): where the standard game starts and ends (§3). */
export const ENGLISH_CENTER = 16;

/**
 * The board named `kind`. Callers pass a checked `BoardKind` (saves and prefs
 * are validated before they reach game/, §11); anything else throws rather
 * than quietly reading as one of the two boards.
 */
export function geometryOf(kind: BoardKind): BoardGeometry {
  if (kind === 'english') return ENGLISH;
  if (kind === 'triangle') return TRIANGLE;
  throw new TypeError(`geometryOf: not a board: ${String(kind)}`);
}

/** The hole at (row, col), or −1 when that spot is off the board (§2). */
export function holeIndex(geometry: BoardGeometry, row: number, col: number): number {
  return geometry.holes.findIndex((hole) => hole.row === row && hole.col === col);
}

/** Whether `value` names a hole of this board: a whole number in range. */
export function isHole(geometry: BoardGeometry, value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < geometry.holes.length
  );
}
