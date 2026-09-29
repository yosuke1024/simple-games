/**
 * Core Binary Balance types. See docs/BINARY_BALANCE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays. Boards are always
 * square with an even side (§1), so a single size travels with a session.
 */

/** The three tiers (§7). Each carries one size (§1), but the size is not the tier. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

/**
 * The board size (§1): 6×6 at every tier. The tiers differ by technique set
 * alone (§7); 8×8 was measured and dropped (§1, §6), and anything but 6×6 is
 * deliberately absent (§14). The table stays per tier so the record's size
 * check reads the same as in the sibling games.
 */
export type Size = 6;
export const SIZE_FOR: Record<Difficulty, Size> = { easy: 6, medium: 6, hard: 6 };

export const isSize = (value: unknown): value is Size => value === 6;

export const cellCount = (size: number): number => size * size;

/** How many of each mark a finished line holds (§3, rule 2). */
export const halfLine = (size: number): number => size / 2;

/**
 * A cell of a finished board. `0` is the circle and `1` the square (§1): the
 * digits are the internal representation only — the board draws two shapes.
 */
export type Cell = 0 | 1;
export const CIRCLE: Cell = 0;
export const SQUARE: Cell = 1;

/**
 * A cell of a board in play: a mark, or nothing yet. Empty is -1 so the two
 * marks can stay the digits a line pattern is built from.
 */
export type Mark = -1 | 0 | 1;
export const EMPTY: Mark = -1;

/** Narrows a cell to the mark written in it. Empty cells and off-board reads fail. */
export const isWritten = (value: Mark | undefined): value is Cell =>
  value === CIRCLE || value === SQUARE;

/** The other mark — the whole of what rules 1 and 2 ever conclude. */
export const other = (value: Cell): Cell => (value === CIRCLE ? SQUARE : CIRCLE);

/**
 * A link between two neighbouring cells (§1, §3 rule 3). `index` is the upper
 * or left cell; `h` joins it to the cell on its right, `v` to the cell below.
 * `same` is `=`, otherwise `×`.
 */
export type LinkDir = 'h' | 'v';
export interface Link {
  readonly index: number;
  readonly dir: LinkDir;
  readonly same: boolean;
}

/** The cell at the other end of a link. */
export const linkOther = (link: Pick<Link, 'index' | 'dir'>, size: number): number =>
  link.dir === 'h' ? link.index + 1 : link.index + size;

/** The canonical order links are kept in: by cell, `h` before `v`. */
export const compareLinks = (a: Link, b: Link): number =>
  a.index - b.index || (a.dir === b.dir ? 0 : a.dir === 'h' ? -1 : 1);

/** Which suspended slot a game belongs to (§10, §11). */
export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Binary Balance — no mistakes counted, no lives (§2, §14). */
export type GameStatus = 'playing' | 'solved';

/** One row or column, named the way a hint has to name it (§8). */
export interface Line {
  readonly axis: 'row' | 'col';
  readonly index: number;
}

/**
 * How many links a tier's candidate starts with (§6 step 2), drawn from this
 * range by the seed. Digging and pruning decide how many survive.
 */
export interface TierShape {
  readonly minLinks: number;
  readonly maxLinks: number;
}

export const TIERS: Record<Difficulty, TierShape> = {
  easy: { minLinks: 6, maxLinks: 9 },
  medium: { minLinks: 6, maxLinks: 10 },
  hard: { minLinks: 10, maxLinks: 16 },
};
