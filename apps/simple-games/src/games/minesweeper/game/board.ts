/**
 * Board geometry and the mine field itself (docs/MINESWEEPER_RULES.md §1).
 *
 * Everything downstream — solver, generator, engine — asks this module two
 * questions: "which cells touch this one?" and "how many mines does it see?".
 * Both answers are precomputed once per board size, because the generator asks
 * them hundreds of thousands of times inside the budget of §5.
 */
import type { Preset } from './types';

export interface MineField {
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
  /** True where a mine sits, row-major. */
  readonly mines: readonly boolean[];
  /** Adjacent mine count per cell, row-major. Meaningless on a mine cell. */
  readonly counts: readonly number[];
}

export const rowOf = (width: number, index: number): number => Math.floor(index / width);
export const colOf = (width: number, index: number): number => index % width;
export const indexOf = (width: number, row: number, col: number): number => row * width + col;

/**
 * The up-to-8 neighbours of every cell, built once per board size. Boards are
 * created and thrown away constantly during generation, so the tables are
 * cached by size rather than carried on the field.
 */
const NEIGHBOUR_CACHE = new Map<string, readonly (readonly number[])[]>();

export function neighbourTable(width: number, height: number): readonly (readonly number[])[] {
  const key = `${width}x${height}`;
  const cached = NEIGHBOUR_CACHE.get(key);
  if (cached) return cached;

  const table: number[][] = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const neighbours: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = row + dr;
          const c = col + dc;
          if (r < 0 || r >= height || c < 0 || c >= width) continue;
          neighbours.push(indexOf(width, r, c));
        }
      }
      table.push(neighbours);
    }
  }
  NEIGHBOUR_CACHE.set(key, table);
  return table;
}

/** The cell itself plus its neighbours — the region the first tap keeps clear (§4). */
export function cellAndNeighbours(width: number, height: number, index: number): number[] {
  return [index, ...neighbourTable(width, height)[index]!];
}

/** Builds the counts of §1 from a mine layout. */
export function fieldFromMines(
  width: number,
  height: number,
  mines: readonly boolean[],
): MineField {
  const table = neighbourTable(width, height);
  const counts = new Array<number>(width * height).fill(0);
  for (let i = 0; i < counts.length; i++) {
    let n = 0;
    for (const neighbour of table[i]!) if (mines[neighbour]) n++;
    counts[i] = n;
  }
  return { width, height, mines, counts };
}

/** An empty field of the preset's size — the board shown before the first tap. */
export function emptyField(preset: Preset): MineField {
  const cells = preset.width * preset.height;
  return fieldFromMines(preset.width, preset.height, new Array<boolean>(cells).fill(false));
}

export const mineCount = (field: MineField): number => {
  let n = 0;
  for (const mine of field.mines) if (mine) n++;
  return n;
};

export const safeCellCount = (field: MineField): number =>
  field.mines.length - mineCount(field);

/**
 * Opens `index` and, when it sees no mines, everything connected to it plus
 * that region's rim (§3, flood fill). Mutates the `opened` array it is given —
 * the callers all own a fresh copy — and returns how many cells it opened.
 *
 * Iterative rather than recursive: a hard board's opening region can run to
 * two hundred cells, and a phone's stack is not the place to find that out.
 */
export function openRegion(field: MineField, index: number, opened: boolean[]): number {
  if (opened[index]) return 0;
  const table = neighbourTable(field.width, field.height);
  const stack = [index];
  let count = 0;
  while (stack.length > 0) {
    const cell = stack.pop()!;
    if (opened[cell]) continue;
    opened[cell] = true;
    count++;
    // A number is a wall: the player reads it and decides what to open next.
    if (field.counts[cell] !== 0 || field.mines[cell]) continue;
    for (const neighbour of table[cell]!) {
      if (!opened[neighbour] && !field.mines[neighbour]) stack.push(neighbour);
    }
  }
  return count;
}
