/**
 * Core Loop Puzzle types. See docs/LOOP_PUZZLE_RULES.md — the single source
 * of truth for the rules these shapes serve.
 *
 * A board is W×H cells on a lattice of (W+1)×(H+1) dots. The player marks the
 * edges between neighbouring dots; everything a rule is read against is a
 * flat, row-major array (cells, dots, edges), never an object per square, so
 * the solver's hot loops stay on typed arrays (§1).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export interface Preset {
  /** Columns of cells. */
  readonly width: number;
  /** Rows of cells. */
  readonly height: number;
}

/**
 * The three boards (§1). The size is what suits each tier on a phone; the
 * difficulty itself is the technique the board needs and how thin its clues
 * are (§7), never the size alone.
 */
export const PRESETS: Record<Difficulty, Preset> = {
  easy: { width: 4, height: 4 },
  medium: { width: 5, height: 5 },
  hard: { width: 6, height: 6 },
};

export const cellCount = (preset: Preset): number => preset.width * preset.height;

export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Loop Puzzle — no mistakes counted, no lives (§3, §15). */
export type GameStatus = 'playing' | 'solved';

/**
 * What the player has written on one edge (§4). A tap walks
 * UNKNOWN → LINE → CROSS → UNKNOWN. CROSS is a note ("not part of the loop")
 * and the win reads LINE alone, so CROSS and UNKNOWN are the same to it (§3).
 */
export const UNKNOWN = 0;
export const LINE = 1;
export const CROSS = 2;
export type Mark = typeof UNKNOWN | typeof LINE | typeof CROSS;

/** Clue numbers run 0–3 (§2). A 4 would be a one-cell loop, which no board ships. */
export const MAX_CLUE = 3;

/** One cell's clue: how many of its four edges the loop uses, or null for none (§2). */
export type Clue = number | null;

export const isClue = (value: unknown): value is Clue =>
  value === null ||
  (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_CLUE);

/** The board's shape and its clues — everything a rule is read against. */
export interface Layout {
  readonly width: number;
  readonly height: number;
  /** One per cell, row-major. */
  readonly clues: readonly Clue[];
}

/** The player's board: one mark per edge. */
export type Marks = readonly Mark[];

/** The smallest and largest side a record may claim (§12). */
export const MIN_SIDE = 2;
export const MAX_SIDE = 8;

/** Structural validation of a clue list: one entry per cell, each 0–3 or null. */
export function isValidClueList(clues: readonly unknown[], width: number, height: number): boolean {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false;
  if (width < MIN_SIDE || height < MIN_SIDE || width > MAX_SIDE || height > MAX_SIDE) return false;
  return clues.length === width * height && clues.every(isClue);
}
