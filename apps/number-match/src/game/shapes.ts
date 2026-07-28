/**
 * Board shapes — implements docs/NUMBER_MATCH_RULES.md §13.
 *
 * A shape decides the width of every row of the STARTING board. Rows are
 * centred, and slots outside a row's width are holes (null), which is what
 * gives a board an outline instead of a plain rectangle.
 *
 * Three rules keep an outline from looking accidental:
 *
 *  - **Whole motifs.** A shape is a function of the row count, not a repeating
 *    cycle, so it always draws a complete figure at whatever size the level
 *    calls for. A cycle cut off partway reads as a mistake — half a diamond
 *    is not a diamond.
 *  - **Odd widths only.** COLS is odd, so only an odd width sits centred; an
 *    even one lands one column to the left with a lone hole on the right.
 *  - **Complete rows.** The starting board never ends on a half-filled row.
 *
 * Only the starting board is shaped. Add Numbers appends plain full-width
 * rows: once the player is refilling, the board is a working surface rather
 * than a picture, and this is what the reference game does throughout.
 */
import { COLS } from './constants';
import { createRng } from './rng';

/** The widths a row may take: odd, so every row centres cleanly. */
const ODD_WIDTHS = [3, 5, 7, 9] as const;

const snapOdd = (value: number): number =>
  ODD_WIDTHS.reduce((best, w) => (Math.abs(w - value) < Math.abs(best - value) ? w : best), COLS);

/** Straight run from `from` at the top to `to` at the bottom. */
const ramp = (rows: number, from: number, to: number): number[] =>
  Array.from({ length: rows }, (_, i) =>
    snapOdd(rows === 1 ? to : from + ((to - from) * i) / (rows - 1)),
  );

/** Symmetric run: `edge` at both ends, `middle` in the centre. */
const arc = (rows: number, edge: number, middle: number): number[] =>
  Array.from({ length: rows }, (_, i) => {
    if (rows < 3) return snapOdd(middle);
    const half = (rows - 1) / 2;
    return snapOdd(edge + (middle - edge) * (1 - Math.abs(i - half) / half));
  });

export interface Shape {
  readonly key: string;
  /** Row widths for a board of exactly `rows` rows. */
  readonly widths: (rows: number) => number[];
}

export const SHAPES: readonly Shape[] = [
  { key: 'rectangle', widths: (rows) => Array.from({ length: rows }, () => COLS) },
  { key: 'diamond', widths: (rows) => arc(rows, 3, 9) },
  { key: 'hourglass', widths: (rows) => arc(rows, 9, 3) },
  { key: 'pyramid', widths: (rows) => ramp(rows, 3, 9) },
  { key: 'funnel', widths: (rows) => ramp(rows, 9, 3) },
];

export const RECTANGLE: Shape = SHAPES[0]!;

/** Early levels stay rectangular so the rules land before the shapes do. */
export const RECTANGLE_ONLY_UP_TO_LEVEL = 3;

/** A shape needs room to read; below this many rows everything is a rectangle. */
const MIN_ROWS_FOR_SHAPE = 4;

function pick(seed: string): Shape {
  const rng = createRng(seed);
  return SHAPES[Math.floor(rng() * SHAPES.length)] ?? RECTANGLE;
}

export function shapeForLevel(level: number): Shape {
  if (level <= RECTANGLE_ONLY_UP_TO_LEVEL) return RECTANGLE;
  return pick(`shape-level-${level}`);
}

export function shapeForDaily(dateString: string): Shape {
  return pick(`shape-daily-${dateString}`);
}

/** The shape of a session, from whichever identity it has. */
export function shapeForSession(level: number | null, dailyDate: string | null): Shape {
  return level !== null ? shapeForLevel(level) : shapeForDaily(dailyDate ?? '');
}

/**
 * Which slots of a row are playable, centred within COLS.
 * `rowLayout(5)` → [f,f,t,t,t,t,t,f,f]
 */
export function rowLayout(width: number): boolean[] {
  const w = Math.max(1, Math.min(COLS, width));
  const lead = Math.floor((COLS - w) / 2);
  return Array.from({ length: COLS }, (_, c) => c >= lead && c < lead + w);
}

/**
 * The row widths of a starting board holding roughly `targetCells` numbers.
 *
 * The row count is chosen so the total lands as close to the target as a
 * whole number of rows allows; the exact count therefore drifts a little
 * either side of the difficulty target, which matters far less than the
 * board looking deliberate.
 */
export function startingWidths(shape: Shape, targetCells: number): number[] {
  let best = shape.widths(1);
  let bestDiff = Infinity;
  for (let rows = 1; rows <= 12; rows++) {
    const widths = shape.widths(rows);
    const sum = widths.reduce((total, w) => total + w, 0);
    const diff = Math.abs(sum - targetCells);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = widths;
    }
    if (sum >= targetCells + COLS) break;
  }
  // Too few rows to read as anything but a rectangle.
  return best.length < MIN_ROWS_FOR_SHAPE && shape !== RECTANGLE
    ? startingWidths(RECTANGLE, targetCells)
    : best;
}
