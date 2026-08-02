/**
 * Level definitions — implements docs/NUMBER_MATCH_RULES.md §11 and §13.
 *
 * All 100 levels are derived from formulas + a fixed seed per level, so no
 * content pipeline or download is ever needed and every player sees the same
 * board for a given level. Difficulty rises gently through two knobs only:
 * starting size and starting pair density. The board's outline comes from
 * shapes.ts and does not affect difficulty. Add Numbers / Undo / Hint stay
 * unlimited and free at every level (brand promise).
 *
 * The list is 100 long rather than 999. Stretched over 999 levels the knobs
 * moved too slowly to notice — one extra number every 25 levels, a pair-density
 * step of four ten-thousandths — so the climb read as one long plateau and the
 * top was never reached by anybody. The same journey now happens across 100
 * levels; the endless side of the game is the daily board, which is unchanged.
 */
import { generateBoard } from './board';
import { shapeForLevel } from './shapes';
import type { Board } from './types';

export const MAX_LEVEL = 100;

const BASE_CELLS = 25;
const MAX_LEVEL_CELLS = 63; // 7 rows
const LEVELS_PER_CELL_STEP = 2;

export const clampLevel = (level: number): number =>
  Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `level-${clampLevel(level)}`;
}

/** 25 numbers at level 1, +1 every 2 levels, capped at 63 (reached at 77). */
export function initialCellsForLevel(level: number): number {
  const step = Math.floor((clampLevel(level) - 1) / LEVELS_PER_CELL_STEP);
  return Math.min(MAX_LEVEL_CELLS, BASE_CELLS + step);
}

/**
 * Probability that a generated digit is biased to pair with a neighbour.
 * Falls linearly from 0.6 (level 1) to 0.2 (level 100): early boards offer
 * many easy pairs, late boards need planning around Add Numbers.
 */
export function pairBiasForLevel(level: number): number {
  const l = clampLevel(level);
  return 0.6 - (0.4 * (l - 1)) / (MAX_LEVEL - 1);
}

/**
 * Daily boards use a fixed mid-curve bias so difficulty does not swing from
 * day to day. Roughly level 50 — the same board it has always been, since the
 * value is a constant and not a point on the level curve.
 */
export const DAILY_PAIR_BIAS = 0.4;

// Where stones and wilds start appearing (§16). The wild comes first: it only
// ever helps, so it introduces the idea of a special tile before the obstacle
// that punishes bad planning shows up. Both are deliberately low — they are
// part of what the game is, not a late-game twist. Levels below the first wild
// are the stretch where the three rules the tutorial taught are the whole game.
const FIRST_WILD_LEVEL = 6;
const SECOND_WILD_LEVEL = 55;
const FIRST_STONE_LEVEL = 15;
const LEVELS_PER_EXTRA_STONE = 25;
const MAX_STONES = 4;

/** Wilds on a level's starting board: 1 from level 6, 2 from level 55. */
export function wildCountForLevel(level: number): number {
  const l = clampLevel(level);
  if (l < FIRST_WILD_LEVEL) return 0;
  return l >= SECOND_WILD_LEVEL ? 2 : 1;
}

/** Stones on a level's starting board: 1 from level 15, +1 every 25, max 4. */
export function stoneCountForLevel(level: number): number {
  const l = clampLevel(level);
  if (l < FIRST_STONE_LEVEL) return 0;
  return Math.min(MAX_STONES, 1 + Math.floor((l - FIRST_STONE_LEVEL) / LEVELS_PER_EXTRA_STONE));
}

/** Deterministic level board: same level → same board, on every device. */
export function generateLevelBoard(level: number): Board {
  const l = clampLevel(level);
  return generateBoard(levelSeed(l), {
    shape: shapeForLevel(l),
    cellCount: initialCellsForLevel(l),
    pairBias: pairBiasForLevel(l),
    stoneCount: stoneCountForLevel(l),
    wildCount: wildCountForLevel(l),
  });
}
