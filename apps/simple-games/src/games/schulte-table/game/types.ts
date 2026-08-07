/**
 * Core Schulte Table types. See docs/SCHULTE_TABLE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A board is N² distinct numbers row-major, every value from 1 to N² exactly
 * once (§1). There is no blank and nothing is ever removed: a tapped cell
 * stays where it is and only changes how it looks (§3), so the search stays
 * exactly as hard at the end of a round as at the start.
 *
 * Cells carry numbers and nothing else — no colour meaning, no symbols (§1).
 * ASCII 0-9 looks the same in all fourteen locales, and a colour-coded board
 * would hand a different game to a player with a colour vision deficiency.
 */

/** The three board sizes this release ships (§1, §7). */
export type Size = 3 | 4 | 5;
export const SIZES: readonly Size[] = [3, 4, 5];

export const isSize = (value: unknown): value is Size => value === 3 || value === 4 || value === 5;

/**
 * Which order the round is tapped in (§5). Three orders, all defined by number
 * order alone — the two-colour Gorbov variant is deliberately absent, because
 * its two series can only be told apart by colour.
 */
export type Order = 'ascending' | 'descending' | 'oddThenEven';
export const ORDERS: readonly Order[] = ['ascending', 'descending', 'oddThenEven'];

export const isOrder = (value: unknown): value is Order =>
  value === 'ascending' || value === 'descending' || value === 'oddThenEven';

/** N² values row-major: the number printed in each cell. */
export type Values = readonly number[];

export const cellCount = (size: Size): number => size * size;
export const rowOf = (index: number, size: Size): number => Math.floor(index / size);
export const colOf = (index: number, size: Size): number => index % size;

export type GameMode = 'level' | 'daily';
export type GameStatus = 'playing' | 'cleared';
