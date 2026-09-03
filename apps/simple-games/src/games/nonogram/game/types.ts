/**
 * Core Nonogram types. See docs/NONOGRAM_RULES.md — the single source of truth
 * for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays. Boards are always
 * square (§1), so a single size travels instead of a width and a height.
 */

/** The two board sizes (§1). Anything larger loses a finger-sized cell. */
export type Size = 5 | 10;
export const SIZES: readonly Size[] = [5, 10];

export const isSize = (value: unknown): value is Size => value === 5 || value === 10;

export const cellCount = (size: Size): number => size * size;

/** A solution cell: painted or not. Numbers, so lines stay flat arrays. */
export type Cell = 0 | 1;
export const EMPTY: Cell = 0;
export const PAINTED: Cell = 1;

/**
 * A player's mark on one cell (§3). The cross is an aid for the player's own
 * reasoning and never decides anything (§2).
 */
export type Mark = 0 | 1 | 2;
export const UNKNOWN: Mark = 0;
export const FILLED: Mark = 1;
export const CROSSED: Mark = 2;

/** One row's or column's clue: run lengths in order. An empty line is `[]`. */
export type Clue = readonly number[];

/** Level list, the daily, or a free board at a chosen tier (§6「フリープレイ」). */
export type GameMode = 'level' | 'daily' | 'free';

/** There is no losing a Nonogram — no mistakes counted, no lives (§2, §13). */
export type GameStatus = 'playing' | 'solved';
