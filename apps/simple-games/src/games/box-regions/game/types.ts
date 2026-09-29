/**
 * Core Box Regions types. See docs/BOX_REGIONS_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays and bitmasks.
 * Width and height travel together because the layout is what every rule is
 * read against (§1).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export interface Preset {
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
}

/**
 * The three boards (§1). Difficulty is a set of techniques and a way of
 * thinning clues (§7), not a size; the size is only what suits each tier.
 * Nothing wider than 7: a clue cell carries a symbol and a number at once.
 */
export const PRESETS: Record<Difficulty, Preset> = {
  easy: { width: 5, height: 5 },
  medium: { width: 6, height: 6 },
  hard: { width: 7, height: 7 },
};

export const cellCount = (preset: Preset): number => preset.width * preset.height;

export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Box Regions — no mistakes counted, no lives (§3, §14). */
export type GameStatus = 'playing' | 'solved';

/**
 * The four kinds of §2. square / tall / wide split every rectangle between
 * them; `free` is the clue that names no kind at all.
 */
export type ShapeKind = 'square' | 'tall' | 'wide' | 'free';
export const SHAPE_KINDS: readonly ShapeKind[] = ['square', 'tall', 'wide', 'free'];

export const isShapeKind = (value: unknown): value is ShapeKind =>
  SHAPE_KINDS.includes(value as ShapeKind);

/** Region area bounds (§1): a 1×1 is a legal square, thirteen cells is not a box. */
export const MIN_REGION_SIZE = 1;
export const MAX_REGION_SIZE = 12;
/** A region is one lowercase letter in a save (§11), so at most 26 of them. */
export const MAX_REGIONS = 26;
/** Generation places at most this many 1×1 regions on one board (§1, §8). */
export const MAX_UNIT_REGIONS = 2;

/**
 * One clue (§2): the cell it sits on, the region's area if given, and its
 * kind. A clue always has a kind — "says nothing" is `free` with no number,
 * so a clue cell always draws a symbol (§13).
 */
export interface Clue {
  readonly index: number;
  readonly size: number | null;
  readonly kind: ShapeKind;
}

/** A cell with no region yet. Regions themselves are 0-based clue indices. */
export const UNASSIGNED = -1;

/** The board's shape and its clues — everything a rule is read against. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
}

/** A layout with its one answer: region index per cell, row-major. */
export interface Puzzle extends Layout {
  readonly solution: readonly number[];
}

/** A cell's region on the player's board: a region index, or UNASSIGNED. */
export type Assignment = readonly number[];

export const rowOf = (index: number, width: number): number => Math.floor(index / width);
export const colOf = (index: number, width: number): number => index % width;

/** The orthogonal neighbours of a cell, inside the board. */
export function neighbors(index: number, width: number, height: number): number[] {
  const row = rowOf(index, width);
  const col = colOf(index, width);
  const out: number[] = [];
  if (row > 0) out.push(index - width);
  if (col > 0) out.push(index - 1);
  if (col < width - 1) out.push(index + 1);
  if (row < height - 1) out.push(index + width);
  return out;
}

/**
 * Structural validation of a clue list (§11): distinct in-range cells, sizes
 * inside the bounds, known kinds. The rules themselves are checked against a
 * solution in serialize.ts.
 */
export function isValidClueList(clues: readonly Clue[], width: number, height: number): boolean {
  if (clues.length === 0 || clues.length > MAX_REGIONS) return false;
  const cells = width * height;
  const seen = new Set<number>();
  for (const clue of clues) {
    if (!Number.isInteger(clue.index) || clue.index < 0 || clue.index >= cells) return false;
    if (seen.has(clue.index)) return false;
    seen.add(clue.index);
    if (
      clue.size !== null &&
      (!Number.isInteger(clue.size) || clue.size < MIN_REGION_SIZE || clue.size > MAX_REGION_SIZE)
    ) {
      return false;
    }
    if (!isShapeKind(clue.kind)) return false;
  }
  return true;
}
