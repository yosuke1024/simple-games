/**
 * Core Minesweeper types. See docs/MINESWEEPER_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * A board is addressed by one row-major index, never by a pair, so the solver
 * and the generator can keep their hot loops on flat arrays. Width and height
 * travel with the field because the three presets are not square (§1).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export interface Preset {
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
  readonly mines: number;
}

/**
 * The three boards (§1). Sizes are chosen so a cell stays big enough to press
 * with a finger on a phone held in portrait; difficulty comes from mine density
 * rather than from a wider board. The original expert board (30 cells across)
 * is deliberately not reproduced (§13).
 *
 * Hard is 14 columns by 18 rows: the rules table writes it "14×18", and of the
 * two readings this is the one that keeps the promise the same section makes —
 * the narrower board is the one a thumb can still hit.
 */
export const PRESETS: Record<Difficulty, Preset> = {
  easy: { width: 9, height: 9, mines: 10 },
  medium: { width: 12, height: 12, mines: 25 },
  hard: { width: 14, height: 18, mines: 50 },
};

export const cellCount = (preset: Preset): number => preset.width * preset.height;

/** Mine density, for the tests that pin the table of §1. */
export const mineDensity = (preset: Preset): number => preset.mines / cellCount(preset);

export type GameMode = 'difficulty' | 'daily';

/**
 * A game ends when a mine is opened; that is the game, not a punishment (§2).
 * There is no third outcome — flags do not decide anything (§2).
 */
export type GameStatus = 'playing' | 'won' | 'lost';
