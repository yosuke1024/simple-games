/**
 * Core Crown Grid types. See docs/CROWN_GRID_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays. Boards are
 * always square, so a single size travels with a session.
 */

/** The three tiers (§7). Each carries one size (§1), but the size is not the tier. */
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

/**
 * The board sizes (§1): 6 for Easy, 8 for Medium, 9 for Hard. Nothing above 9
 * — a tenth column drops a cell under a fingertip at 320px (Nonogram §1).
 */
export type Size = 6 | 8 | 9;
export const SIZE_FOR: Record<Difficulty, Size> = { easy: 6, medium: 8, hard: 9 };

export const isSize = (value: unknown): value is Size => value === 6 || value === 8 || value === 9;

export const cellCount = (size: number): number => size * size;

/**
 * A cell of a board in play (§1): nothing, the player's × note, or a crown.
 * Small integers so the marks board is a plain number array the engine can
 * scan without a lookup table.
 */
export type Mark = 0 | 1 | 2;
export const EMPTY: Mark = 0;
export const CROSS: Mark = 1;
export const CROWN: Mark = 2;

/** Which suspended slot a game belongs to (§9, §11). */
export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Crown Grid — no mistakes counted, no lives (§2, §14). */
export type GameStatus = 'playing' | 'solved';

/**
 * A house: one row, one column, or one region — the three kinds of set that
 * hold exactly one crown (§3). Named the way a hint has to name it (§6).
 */
export interface House {
  readonly kind: 'row' | 'col' | 'region';
  readonly index: number;
}

/**
 * The partition of the board into regions: one region id (0..N-1) per cell,
 * row-major (§1). Validity — N connected regions covering the board — is a
 * rule of engine.ts (`isValidRegions`), not of this shape.
 */
export type Regions = readonly number[];

/** The hidden answer: the column of the crown in each row (§8, §11). */
export type Solution = readonly number[];

/**
 * Structural validation for the fail-closed save loading of §11: right length,
 * and nothing in it that play could not have written. The rules themselves are
 * checked separately (engine.ts) — this is only the shape.
 */
export function isValidMarks(value: unknown, size: Size): value is Mark[] {
  if (!Array.isArray(value) || value.length !== cellCount(size)) return false;
  return value.every((cell) => cell === EMPTY || cell === CROSS || cell === CROWN);
}
