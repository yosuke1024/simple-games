/**
 * Core Water Sort types. See docs/WATER_SORT_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A board is an array of tubes; a tube is its colors bottom-to-top. Colors
 * are indices — the palette and its paired symbols are a UI concern (§1), so
 * the logic never knows what a color looks like.
 */

/** Units of one color, and the height of every tube (§1). */
export const TUBE_CAPACITY = 4;

/** Spare room: every board has exactly two empty tubes to work with (§1). */
export const EMPTY_TUBES = 2;

/** The color counts this release ships (§6, §7). */
export const MIN_COLORS = 3;
export const MAX_COLORS = 9;

/** Color indices bottom-to-top; length 0 (empty) to TUBE_CAPACITY (full). */
export type Tube = readonly number[];
export type Tubes = readonly Tube[];

export const tubeCount = (colors: number): number => colors + EMPTY_TUBES;

/** A generated puzzle: the board and what produced it. */
export interface Puzzle {
  readonly seed: string;
  readonly colors: number;
  readonly tubes: Tubes;
}

export type GameMode = 'level' | 'daily';
export type GameStatus = 'playing' | 'solved';

/** One pour: source tube index → destination tube index. */
export interface Pour {
  readonly from: number;
  readonly to: number;
}

/**
 * A board that could have come from generation or play: the right number of
 * tubes for its color count, no overfilled tube, and exactly a tube's worth
 * of every color.
 */
export function isValidTubes(tubes: Tubes, colors: number): boolean {
  if (colors < MIN_COLORS || colors > MAX_COLORS) return false;
  if (tubes.length !== tubeCount(colors)) return false;
  const counts = new Array<number>(colors).fill(0);
  for (const tube of tubes) {
    if (tube.length > TUBE_CAPACITY) return false;
    for (const color of tube) {
      if (!Number.isInteger(color) || color < 0 || color >= colors) return false;
      counts[color]! += 1;
    }
  }
  return counts.every((count) => count === TUBE_CAPACITY);
}
