/**
 * Board generation — implements docs/NUMBER_MATCH_RULES.md §10 and §13.
 * Deterministic per seed; the same seed always produces the same board,
 * outline included.
 */
import { COLS, INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { createRng } from './rng';
import { RECTANGLE, rowLayout, startingWidths, type Shape } from './shapes';
import { isLive, type Board, type BoardCell, type Digit } from './types';

const MAX_GENERATION_ATTEMPTS = 100;

export interface GenerateOptions {
  /** Outline of the starting board; defaults to the classic rectangle. */
  shape?: Shape;
  /**
   * Target number of numbers. The board is built from whole rows, so the
   * actual count lands on the nearest complete row rather than exactly here
   * — a half-filled last row reads as cut off, not as a shape (§13).
   */
  cellCount?: number;
  /**
   * Chance that a number is drawn to pair with a neighbour (left or above).
   * Higher = easier board.
   */
  pairBias?: number;
}

/**
 * Fills a shaped grid with digits. `pairBias` biases a slot towards making a
 * pair with the number to its left or above it, which is the single knob that
 * makes early levels gentle (§11).
 */
export function generateBoard(seed: string, options: GenerateOptions = {}): Board {
  const shape = options.shape ?? RECTANGLE;
  const cellCount = options.cellCount ?? INITIAL_CELLS;
  const bias = options.pairBias ?? 0;
  const rng = createRng(seed);

  // Whole rows only, as close to the target as the shape allows.
  const layouts = startingWidths(shape, cellCount).map(rowLayout);

  const draw = (): BoardCell[] => {
    const cells: BoardCell[] = [];
    for (const layout of layouts) {
      for (const playable of layout) {
        if (!playable) {
          cells.push(null);
          continue;
        }
        const index = cells.length;
        const neighbours: Digit[] = [];
        for (const candidate of [cells[index - 1], cells[index - COLS]]) {
          if (isLive(candidate)) neighbours.push(candidate.value);
        }
        let value: Digit;
        if (neighbours.length > 0 && rng() < bias) {
          const partner = neighbours[Math.floor(rng() * neighbours.length)]!;
          value = rng() < 0.5 ? partner : ((10 - partner) as Digit);
        } else {
          value = (1 + Math.floor(rng() * 9)) as Digit;
        }
        cells.push({ value, cleared: false });
      }
    }
    return cells;
  };

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const cells = draw();
    if (hasAnyMove(cells)) return cells;
  }
  // Deterministic fallback (unreachable in practice): force one valid pair.
  const cells = draw();
  const first = cells.findIndex((c) => isLive(c));
  const second = cells.findIndex((c, i) => i > first && isLive(c));
  if (first >= 0 && second >= 0) {
    cells[second] = { value: (cells[first] as { value: Digit }).value, cleared: false };
  }
  return cells;
}

/** Classic rectangular board (used by Daily Challenge's default shape). */
export function generateInitialBoard(seed: string, cellCount: number = INITIAL_CELLS): Board {
  return generateBoard(seed, { cellCount });
}
