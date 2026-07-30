/**
 * Core Sliding Puzzle types. See docs/SLIDING_PUZZLE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A board is N² numbers row-major where 0 is the blank. The blank is a value
 * rather than a separate field: every move is a permutation of the same array,
 * so "where the blank is" can never disagree with where the tiles are.
 *
 * Tiles carry numbers and nothing else — no images (§1). A picture would have
 * to be translated or shipped per language, and a number is legible at 5x5 on
 * a small phone in every language at once (docs/I18N_POLICY.md).
 */

/** The three board sizes this release ships (§1, §13). */
export type Size = 3 | 4 | 5;
export const SIZES: readonly Size[] = [3, 4, 5];

export const isSize = (value: unknown): value is Size =>
  value === 3 || value === 4 || value === 5;

/** N² values, row-major. 0 is the blank; 1..N²-1 are the tiles. */
export type Tiles = readonly number[];

export const cellCount = (size: Size): number => size * size;
export const rowOf = (index: number, size: Size): number => Math.floor(index / size);
export const colOf = (index: number, size: Size): number => index % size;
export const indexOf = (row: number, col: number, size: Size): number => row * size + col;

/** The finished board: 1..N²-1 in reading order, blank bottom-right (§2). */
export function solvedTiles(size: Size): Tiles {
  const total = cellCount(size);
  const tiles: number[] = [];
  for (let value = 1; value < total; value++) tiles.push(value);
  tiles.push(0);
  return tiles;
}

/** A generated puzzle: the shuffled board and what produced it. */
export interface Puzzle {
  readonly seed: string;
  readonly size: Size;
  readonly tiles: Tiles;
  /** Single-tile slides actually used to shuffle it (§5, §6). */
  readonly depth: number;
}

export type GameMode = 'level' | 'daily';
export type GameStatus = 'playing' | 'solved';
