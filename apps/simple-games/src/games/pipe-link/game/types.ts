/**
 * Difficulties, modes and board sizes (docs/PIPE_LINK_RULES.md §1, §5, §8).
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

export type GameMode = 'difficulty' | 'daily';

/** There is no losing a Pipe Link — no mistakes counted, no lives (§2, §12). */
export type GameStatus = 'playing' | 'solved';

export interface Preset {
  /** Columns. */
  readonly width: number;
  /** Rows. */
  readonly height: number;
}

/**
 * The three boards (§1). Nothing larger than 8×8: the tile itself is the
 * tap target and cannot be widened (§1, why 9×9 is not in v1).
 */
export const PRESETS: Readonly<Record<Difficulty, Preset>> = {
  easy: { width: 5, height: 5 },
  medium: { width: 7, height: 7 },
  hard: { width: 8, height: 8 },
};
