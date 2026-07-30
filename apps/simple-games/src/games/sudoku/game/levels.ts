/**
 * Level definitions — implements docs/SUDOKU_RULES.md §9.
 *
 * All 999 levels come from the level number alone: a seed and a difficulty
 * band. No content pipeline, no download, and the same level is the same
 * puzzle for every player. Hint and Undo stay unlimited and free at every
 * level (brand promise).
 */
import { hashSeed } from './rng';
import type { Difficulty } from './types';

export const MAX_LEVEL = 999;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `sudoku-level-${clampLevel(level)}`;
}

/**
 * The difficulty mix per band (§9). Weights are out of 100 and must add up.
 * The last band keeps a large share of medium on purpose: 999 levels of
 * unbroken hard reads as a chore, and the brand is a quiet game, not a grind.
 */
interface Band {
  readonly upTo: number;
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
}

const BANDS: readonly Band[] = [
  { upTo: 20, easy: 100, medium: 0, hard: 0 },
  { upTo: 60, easy: 70, medium: 30, hard: 0 },
  { upTo: 150, easy: 40, medium: 60, hard: 0 },
  { upTo: 400, easy: 15, medium: 70, hard: 15 },
  { upTo: 700, easy: 5, medium: 60, hard: 35 },
  { upTo: MAX_LEVEL, easy: 0, medium: 45, hard: 55 },
];

function bandFor(level: number): Band {
  for (const band of BANDS) if (level <= band.upTo) return band;
  return BANDS[BANDS.length - 1]!;
}

/**
 * The difficulty of a level — deterministic, so a level is always the same
 * puzzle at the same tier. The roll comes from a hash of the level rather than
 * from its remainder, so the tiers do not fall into a visible repeating
 * pattern as the player walks up the list.
 */
export function difficultyForLevel(level: number): Difficulty {
  const target = clampLevel(level);
  const band = bandFor(target);
  const roll = hashSeed(`sudoku-tier-${target}`) % 100;
  if (roll < band.easy) return 'easy';
  if (roll < band.easy + band.medium) return 'medium';
  return 'hard';
}
