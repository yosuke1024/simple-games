/**
 * Core Bridges types. See docs/BRIDGES_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is a width×height grid of cells addressed by one row-major index.
 * Some cells hold an island with a number; bridges run along rows and
 * columns between islands. Islands are listed in index order, and an island
 * is named by its position in that list (its "ordinal") everywhere below —
 * the solver and the generator keep their hot loops on flat arrays.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Bridges — no mistakes counted, no lives (§3, §15). */
export type GameStatus = 'playing' | 'solved';

/** At most two bridges join the same two islands (§2). */
export const MAX_BRIDGES_PER_PAIR = 2;

/** An island's number: 1 to 8 — four directions, two bridges each (§1). */
export const MIN_ISLAND_VALUE = 1;
export const MAX_ISLAND_VALUE = 8;

export interface Preset {
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
  /** The fewest islands a board of this tier carries (§7). */
  readonly minIslands: number;
  /** The most islands a board of this tier carries (§7). */
  readonly maxIslands: number;
}

/**
 * The three boards (§1, §7). Difficulty is the size, the island count and —
 * above all — the reasoning the board needs (§7); the size only suits it.
 * Nothing wider than 10: at 360 px an island must stay a fingertip target.
 */
export const PRESETS: Record<Difficulty, Preset> = {
  easy: { width: 7, height: 7, minIslands: 8, maxIslands: 12 },
  medium: { width: 9, height: 9, minIslands: 14, maxIslands: 20 },
  hard: { width: 10, height: 10, minIslands: 20, maxIslands: 28 },
};

/** One island: the cell it sits on and its number (§1). */
export interface Island {
  readonly index: number;
  readonly value: number;
}

/** The board as the player sees it: its size and its islands, in index order. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly islands: readonly Island[];
}

/**
 * Bridges per edge, in the graph's edge order (§4): 0, 1 or 2 each. Both the
 * player's board and the answer take this shape.
 */
export type Bridges = readonly number[];

export const rowOf = (index: number, width: number): number => Math.floor(index / width);
export const colOf = (index: number, width: number): number => index % width;
