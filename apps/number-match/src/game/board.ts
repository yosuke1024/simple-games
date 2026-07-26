/**
 * Board generation — implements docs/NUMBER_MATCH_RULES.md §10.
 * Deterministic per seed; the same seed always produces the same board.
 */
import { INITIAL_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { createRng } from './rng';
import type { Board, Cell, Digit } from './types';

const MAX_GENERATION_ATTEMPTS = 100;

export function generateInitialBoard(seed: string, cellCount: number = INITIAL_CELLS): Board {
  const rng = createRng(seed);
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const cells: Cell[] = Array.from({ length: cellCount }, () => ({
      value: (1 + Math.floor(rng() * 9)) as Digit,
      cleared: false,
    }));
    if (hasAnyMove(cells)) return cells;
  }
  // Deterministic fallback (unreachable in practice): force one valid pair.
  const cells: Cell[] = Array.from({ length: cellCount }, () => ({
    value: (1 + Math.floor(rng() * 9)) as Digit,
    cleared: false,
  }));
  if (cells.length >= 2) {
    const first = cells[0]!;
    cells[1] = { value: first.value, cleared: false };
  }
  return cells;
}
