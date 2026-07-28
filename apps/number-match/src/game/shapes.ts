/**
 * Board shapes — implements docs/NUMBER_MATCH_RULES.md §13.
 *
 * A shape is a cycle of row widths. Every row still occupies COLS slots; the
 * slots outside the row's width are holes (null), which is what produces the
 * "rows with uneven cell counts" look. Rows are centered.
 *
 * Shapes are chosen deterministically from the level (or daily date), so a
 * board's outline is reproducible without storing it.
 */
import { COLS } from './constants';
import { createRng } from './rng';

/** Row-width cycles. The first entry is the classic rectangle. */
export const SHAPE_FAMILIES: readonly (readonly number[])[] = [
  [9],
  [5, 7, 9, 9, 7, 5],
  [9, 8, 7, 6, 5],
  [9, 7, 5, 5, 7, 9],
  [7, 9, 7, 9],
  [3, 5, 7, 9, 9],
];

export const RECTANGLE: readonly number[] = SHAPE_FAMILIES[0]!;

/** Early levels stay rectangular so the rules land before the shapes do. */
export const RECTANGLE_ONLY_UP_TO_LEVEL = 3;

function pick(seed: string): readonly number[] {
  const rng = createRng(seed);
  return SHAPE_FAMILIES[Math.floor(rng() * SHAPE_FAMILIES.length)] ?? RECTANGLE;
}

export function shapeForLevel(level: number): readonly number[] {
  if (level <= RECTANGLE_ONLY_UP_TO_LEVEL) return RECTANGLE;
  return pick(`shape-level-${level}`);
}

export function shapeForDaily(dateString: string): readonly number[] {
  return pick(`shape-daily-${dateString}`);
}

/** The shape of a session, from whichever identity it has. */
export function shapeForSession(
  level: number | null,
  dailyDate: string | null,
): readonly number[] {
  return level !== null ? shapeForLevel(level) : shapeForDaily(dailyDate ?? '');
}

/** Width of row `index` in the shape's cycle. */
export function widthAt(shape: readonly number[], index: number): number {
  const raw = shape[index % shape.length] ?? COLS;
  return Math.max(1, Math.min(COLS, raw));
}

/**
 * Which slots of a row are playable, centered within COLS.
 * `rowLayout(5)` → [f,f,t,t,t,t,t,f,f]
 */
export function rowLayout(width: number): boolean[] {
  const w = Math.max(1, Math.min(COLS, width));
  const lead = Math.floor((COLS - w) / 2);
  return Array.from({ length: COLS }, (_, c) => c >= lead && c < lead + w);
}
