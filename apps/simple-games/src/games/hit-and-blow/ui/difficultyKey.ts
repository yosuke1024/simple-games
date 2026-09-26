/**
 * The catalog key naming each difficulty. Written out rather than assembled
 * (`hitAndBlowDifficulty_${difficulty}`), so every key a screen uses is
 * visible to a grep and to the type checker.
 */
import type { Difficulty } from '../game';

export const DIFFICULTY_KEY = {
  easy: 'hitAndBlowDifficulty_easy',
  normal: 'hitAndBlowDifficulty_normal',
  hard: 'hitAndBlowDifficulty_hard',
} as const satisfies Record<Difficulty, string>;
