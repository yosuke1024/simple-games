/**
 * Core Number Recall types. See docs/NUMBER_RECALL_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A layout is N² slots row-major: `0` is an empty cell and 1..K are the tiles
 * (§1). Empty cells are a value rather than a separate list, so "where the
 * tiles are" can never disagree with "which tiles exist".
 *
 * Tiles carry numbers and nothing else (§1). ASCII 0-9 looks the same in all
 * fourteen locales, and a face-down tile that could only be told from a
 * face-up one by colour would hand a different game to a player with a colour
 * vision deficiency.
 */

/** The three board sizes this release ships (§1, §7). */
export type Size = 3 | 4 | 5;
export const SIZES: readonly Size[] = [3, 4, 5];

export const isSize = (value: unknown): value is Size => value === 3 || value === 4 || value === 5;

/** N² slots row-major: 0 for an empty cell, 1..K for a tile. */
export type Layout = readonly number[];

/** The empty slot. Named because `0` on its own reads as a tile value. */
export const EMPTY = 0;

export const cellCount = (size: Size): number => size * size;
export const rowOf = (index: number, size: Size): number => Math.floor(index / size);
export const colOf = (index: number, size: Size): number => index % size;

export type GameMode = 'level' | 'daily';

/**
 * `failed` is terminal like `cleared` is: the round is over and the board is
 * fully revealed (§4). What follows is a *new* round, never this one resumed —
 * replaying this layout after seeing the answer would be reading it back, not
 * remembering it (§8).
 */
export type GameStatus = 'playing' | 'cleared' | 'failed';
