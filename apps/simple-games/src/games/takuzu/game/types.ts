/**
 * Core Takuzu types. See docs/TAKUZU_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays. Boards are always
 * square with an even side (§1), so a single size travels instead of a width
 * and a height.
 *
 * There is no difficulty type. The three rules are the same at every size, so
 * the only dial the generator has is how many cells it hands the player — and
 * that is a number, interpolated inside a band (levels.ts), not a tier. A tier
 * enum here would be a label with nothing behind it, and Sudoku §6 is the
 * warning: a tier is only honest when it names a set of allowed techniques.
 */

/**
 * The three board sizes (§1). An odd side cannot split a line evenly, so §3's
 * second rule would have nothing to say; 12×12 and up lose a finger-sized cell
 * at 320px, which is the same floor Nonogram drew at 10×10.
 */
export type Size = 6 | 8 | 10;
export const SIZES: readonly Size[] = [6, 8, 10];

export const isSize = (value: unknown): value is Size => value === 6 || value === 8 || value === 10;

export const cellCount = (size: Size): number => size * size;

/** How many of each value a finished line holds (§3, rule 2). */
export const halfLine = (size: Size): number => size / 2;

/** A cell of a finished board: the game is played with the digits themselves. */
export type Cell = 0 | 1;
export const ZERO: Cell = 0;
export const ONE: Cell = 1;

/**
 * A cell of a board in play: a written digit, or nothing yet.
 *
 * Empty is -1 rather than a third small non-negative integer because the two
 * written values *are* 0 and 1 here. `board[i] === ONE` reads as "this cell
 * holds a one" with no lookup table between the array and the rule, and the
 * counting technique can add cells up directly.
 */
export type Mark = -1 | 0 | 1;
export const EMPTY: Mark = -1;

/** Narrows a cell to the digit written in it. Empty cells and off-board reads fail. */
export const isWritten = (value: Mark | undefined): value is Cell =>
  value === ZERO || value === ONE;

/** The other digit — the whole of what rules 1 and 2 ever conclude. */
export const other = (value: Cell): Cell => (value === ZERO ? ONE : ZERO);

export type GameMode = 'level' | 'daily';

/** There is no losing a Takuzu — no mistakes counted, no lives (§2, §14). */
export type GameStatus = 'playing' | 'solved';

/** One row or column, named the way a hint has to name it (§8). */
export interface Line {
  readonly axis: 'row' | 'col';
  readonly index: number;
}

/**
 * Structural validation for the fail-closed save loading of §11: right length,
 * and nothing in it that play could not have written. The rules themselves are
 * checked separately (engine.ts) — this is only the shape.
 */
export function isValidBoard(value: unknown, size: Size): value is Mark[] {
  if (!Array.isArray(value) || value.length !== cellCount(size)) return false;
  return value.every((cell) => cell === EMPTY || cell === ZERO || cell === ONE);
}

/** A board with every cell written — what a solution has to be (§6). */
export function isFilledBoard(value: unknown, size: Size): value is Cell[] {
  if (!Array.isArray(value) || value.length !== cellCount(size)) return false;
  return value.every((cell) => cell === ZERO || cell === ONE);
}
