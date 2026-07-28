/**
 * Level definitions — implements docs/NUMBER_MATCH_RULES.md §11.
 *
 * All 999 levels are derived from formulas + a fixed seed per level, so no
 * content pipeline or download is ever needed and every player sees the same
 * board for a given level. Difficulty rises gently through two knobs only:
 * starting size and starting pair density. Add Numbers / Undo / Hint stay
 * unlimited and free at every level (brand promise).
 */
import { COLS } from './constants';
import { hasAnyMove } from './hint';
import { createRng } from './rng';
import type { Board, Cell, Digit } from './types';

export const MAX_LEVEL = 999;

const BASE_CELLS = 25;
const MAX_LEVEL_CELLS = 63; // 7 rows
const LEVELS_PER_CELL_STEP = 25;

const clampLevel = (level: number): number => Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)));

export function levelSeed(level: number): string {
  return `level-${clampLevel(level)}`;
}

/** 25 cells at level 1, +1 every 25 levels, capped at 63 (7 rows). */
export function initialCellsForLevel(level: number): number {
  const step = Math.floor((clampLevel(level) - 1) / LEVELS_PER_CELL_STEP);
  return Math.min(MAX_LEVEL_CELLS, BASE_CELLS + step);
}

/**
 * Probability that a generated digit is biased to pair with a neighbor.
 * Falls linearly from 0.6 (level 1) to 0.2 (level 999): early boards offer
 * many easy pairs, late boards need planning around Add Numbers.
 */
export function pairBiasForLevel(level: number): number {
  const l = clampLevel(level);
  return 0.6 - (0.4 * (l - 1)) / (MAX_LEVEL - 1);
}

const MAX_GENERATION_ATTEMPTS = 100;

/** Deterministic level board: same level → same board, on every device. */
export function generateLevelBoard(level: number): Board {
  const rng = createRng(levelSeed(level));
  const cellCount = initialCellsForLevel(level);
  const bias = pairBiasForLevel(level);

  const draw = (): Cell[] => {
    const cells: Cell[] = [];
    for (let i = 0; i < cellCount; i++) {
      const neighbors: Digit[] = [];
      const left = cells[i - 1];
      const above = cells[i - COLS];
      if (left) neighbors.push(left.value);
      if (above) neighbors.push(above.value);
      let value: Digit;
      if (neighbors.length > 0 && rng() < bias) {
        const partner = neighbors[Math.floor(rng() * neighbors.length)]!;
        value = rng() < 0.5 ? partner : ((10 - partner) as Digit);
      } else {
        value = (1 + Math.floor(rng() * 9)) as Digit;
      }
      cells.push({ value, cleared: false });
    }
    return cells;
  };

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const cells = draw();
    if (hasAnyMove(cells)) return cells;
  }
  // Deterministic fallback (unreachable in practice): force one valid pair.
  const cells = draw();
  if (cells.length >= 2) {
    cells[1] = { value: cells[0]!.value, cleared: false };
  }
  return cells;
}
