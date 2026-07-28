/**
 * Level definitions — implements docs/NUMBER_MATCH_RULES.md §11 and §13.
 *
 * All 999 levels are derived from formulas + a fixed seed per level, so no
 * content pipeline or download is ever needed and every player sees the same
 * board for a given level. Difficulty rises gently through two knobs only:
 * starting size and starting pair density. The board's outline comes from
 * shapes.ts and does not affect difficulty. Add Numbers / Undo / Hint stay
 * unlimited and free at every level (brand promise).
 */
import { generateBoard } from './board';
import { shapeForLevel } from './shapes';
import type { Board } from './types';

export const MAX_LEVEL = 999;

const BASE_CELLS = 25;
const MAX_LEVEL_CELLS = 63; // 7 rows
const LEVELS_PER_CELL_STEP = 25;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `level-${clampLevel(level)}`;
}

/** 25 numbers at level 1, +1 every 25 levels, capped at 63. */
export function initialCellsForLevel(level: number): number {
  const step = Math.floor((clampLevel(level) - 1) / LEVELS_PER_CELL_STEP);
  return Math.min(MAX_LEVEL_CELLS, BASE_CELLS + step);
}

/**
 * Probability that a generated digit is biased to pair with a neighbour.
 * Falls linearly from 0.6 (level 1) to 0.2 (level 999): early boards offer
 * many easy pairs, late boards need planning around Add Numbers.
 */
export function pairBiasForLevel(level: number): number {
  const l = clampLevel(level);
  return 0.6 - (0.4 * (l - 1)) / (MAX_LEVEL - 1);
}

/** Deterministic level board: same level → same board, on every device. */
export function generateLevelBoard(level: number): Board {
  const l = clampLevel(level);
  return generateBoard(levelSeed(l), {
    shape: shapeForLevel(l),
    cellCount: initialCellsForLevel(l),
    pairBias: pairBiasForLevel(l),
  });
}
