/**
 * Core 2048 types. See docs/GAME_2048_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * A board is 16 plain numbers, row-major: 0 for an empty square, otherwise a
 * power of two. Values rather than tile objects, because every rule in §2 is
 * stated about values and nothing in the engine needs tile identity — the UI
 * derives that from the movement list a slide reports.
 */

export const SIZE = 4;
export const CELLS = SIZE * SIZE;

/** 16 values, row-major. 0 = empty. */
export type Board = readonly number[];

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Every direction a move can take — the set game-over is measured against. */
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** The tile that counts as reaching the goal (§3). Play continues past it. */
export const WIN_VALUE = 2048;

/**
 * The largest tile a 4x4 board can hold. Sixteen squares can at best carry
 * 2^16 worth of new tiles plus one more doubling, so 2^17 is the ceiling; a
 * stored board claiming more than this did not come from play (§7, serialize).
 */
export const MAX_EXPONENT = 17;

export const rowOf = (index: number): number => Math.floor(index / SIZE);
export const colOf = (index: number): number => index % SIZE;
export const indexOf = (row: number, col: number): number => row * SIZE + col;

/** Classic runs forever; the daily is one board a day, shared by everyone (§6). */
export type GameMode = 'classic' | 'daily';

/**
 * 'over' is the end described in §3 — no empty square and no adjacent pair —
 * not a punishment. There is no 'won' status: reaching 2048 is celebrated and
 * the same game carries on.
 */
export type GameStatus = 'playing' | 'over';
