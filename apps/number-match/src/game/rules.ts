/**
 * Pair rules — implements docs/NUMBER_MATCH_RULES.md §2–§3 exactly.
 * Pure functions only: no UI, platform, or service imports.
 */
import { COLS } from './constants';
import type { Board, Digit } from './types';

/** §2: two digits match when equal or summing to 10. */
export function isMatchingValues(a: Digit, b: Digit): boolean {
  return a === b || a + b === 10;
}

const rowOf = (i: number): number => Math.floor(i / COLS);
const colOf = (i: number): number => i % COLS;

/**
 * §3: two positions connect when every cell strictly between them is cleared
 * along one of these paths:
 *  1. reading order (covers same-row horizontal and row-end → next-row-start)
 *  2. vertical (same column)
 *  3. diagonal (equal row and column distance)
 *
 * Returns the number of cleared cells jumped over along the SHORTEST valid
 * path (0 for adjacency), or null when the cells do not connect. The gap
 * feeds the score's distance bonus (§12), so the minimum keeps adjacent
 * pairs from earning long-path bonuses.
 */
export function connectionGap(board: Board, i: number, j: number): number | null {
  if (i === j) return null;
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  if (a < 0 || b >= board.length) return null;

  let best: number | null = null;
  const consider = (gap: number) => {
    if (best === null || gap < best) best = gap;
  };

  // 1. Reading order.
  let clearedBetween = true;
  for (let k = a + 1; k < b; k++) {
    if (!board[k]!.cleared) {
      clearedBetween = false;
      break;
    }
  }
  if (clearedBetween) consider(b - a - 1);

  const ra = rowOf(a);
  const ca = colOf(a);
  const rb = rowOf(b);
  const cb = colOf(b);

  // 2. Vertical.
  if (ca === cb) {
    clearedBetween = true;
    for (let r = ra + 1; r < rb; r++) {
      if (!board[r * COLS + ca]!.cleared) {
        clearedBetween = false;
        break;
      }
    }
    if (clearedBetween) consider(rb - ra - 1);
  }

  // 3. Diagonal (either direction).
  const dr = rb - ra;
  const dc = cb - ca;
  if (dr > 0 && Math.abs(dc) === dr) {
    const step = dc > 0 ? COLS + 1 : COLS - 1;
    clearedBetween = true;
    for (let k = a + step; k < b; k += step) {
      if (!board[k]!.cleared) {
        clearedBetween = false;
        break;
      }
    }
    if (clearedBetween) consider(dr - 1);
  }

  return best;
}

export function canConnect(board: Board, i: number, j: number): boolean {
  return connectionGap(board, i, j) !== null;
}

/** Full pair check: both cells live, values match, and positions connect. */
export function isValidPair(board: Board, i: number, j: number): boolean {
  const a = board[i];
  const b = board[j];
  if (!a || !b || a.cleared || b.cleared) return false;
  return isMatchingValues(a.value, b.value) && canConnect(board, i, j);
}
