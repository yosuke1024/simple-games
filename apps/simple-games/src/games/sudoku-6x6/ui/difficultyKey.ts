/**
 * The catalog key of each difficulty's name, referenced statically so the
 * strings stay greppable (docs/I18N_POLICY.md warns that a key assembled at
 * runtime looks unused). One table, read by the home, the game screen and the
 * statistics.
 */
import type { Difficulty } from '../game';

export const DIFFICULTY_KEY = {
  easy: 'sudoku6x6Difficulty_easy',
  medium: 'sudoku6x6Difficulty_medium',
  hard: 'sudoku6x6Difficulty_hard',
} as const satisfies Record<Difficulty, string>;
