/**
 * Pair rules — implements docs/NUMBER_MATCH_RULES.md §2–§3 exactly.
 * Pure functions only: no UI, platform, or service imports.
 */
import { COLS } from './constants';
import { isLive, isPassable, type Board, type Digit } from './types';

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
 * Holes in the board's shape are transparent, exactly like cleared cells.
 *
 * Returns the number of CLEARED cells jumped over along the SHORTEST valid
 * path (0 for adjacency), or null when the cells do not connect. Holes are
 * not counted — the score's distance bonus (§12) rewards clearing a path,
 * not the board's outline. The minimum keeps adjacent pairs from earning
 * long-path bonuses.
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
  let cleared = 0;
  for (let k = a + 1; k < b; k++) {
    if (!isPassable(board[k])) {
      clearedBetween = false;
      break;
    }
    if (board[k] !== null) cleared++;
  }
  if (clearedBetween) consider(cleared);

  const ra = rowOf(a);
  const ca = colOf(a);
  const rb = rowOf(b);
  const cb = colOf(b);

  // 2. Vertical.
  if (ca === cb) {
    clearedBetween = true;
    cleared = 0;
    for (let r = ra + 1; r < rb; r++) {
      const slot = board[r * COLS + ca];
      if (!isPassable(slot)) {
        clearedBetween = false;
        break;
      }
      if (slot !== null) cleared++;
    }
    if (clearedBetween) consider(cleared);
  }

  // 3. Diagonal (either direction).
  const dr = rb - ra;
  const dc = cb - ca;
  if (dr > 0 && Math.abs(dc) === dr) {
    const step = dc > 0 ? COLS + 1 : COLS - 1;
    clearedBetween = true;
    cleared = 0;
    for (let k = a + step; k < b; k += step) {
      if (!isPassable(board[k])) {
        clearedBetween = false;
        break;
      }
      if (board[k] !== null) cleared++;
    }
    if (clearedBetween) consider(cleared);
  }

  return best;
}

export function canConnect(board: Board, i: number, j: number): boolean {
  return connectionGap(board, i, j) !== null;
}

/**
 * The live cells that stand in the way of connecting i and j, along whichever
 * path is closest to connecting. Empty when the pair already connects.
 *
 * Used only to explain a rejected tap in the UI ("these numbers are in the
 * way"), so unlike connectionGap it allocates — it runs once per tap, never
 * inside the O(n²) hint scan.
 */
export function blockingCells(board: Board, i: number, j: number): readonly number[] {
  if (i === j) return [];
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  if (a < 0 || b >= board.length) return [];

  const liveAmong = (indices: readonly number[]): number[] =>
    indices.filter((k) => isLive(board[k]));

  // 1. Reading order (always geometrically applicable).
  const reading: number[] = [];
  for (let k = a + 1; k < b; k++) reading.push(k);
  let best = liveAmong(reading);

  const ra = rowOf(a);
  const ca = colOf(a);
  const rb = rowOf(b);
  const cb = colOf(b);

  // 2. Vertical.
  if (ca === cb) {
    const vertical: number[] = [];
    for (let r = ra + 1; r < rb; r++) vertical.push(r * COLS + ca);
    const blockers = liveAmong(vertical);
    if (blockers.length < best.length) best = blockers;
  }

  // 3. Diagonal.
  const dr = rb - ra;
  const dc = cb - ca;
  if (dr > 0 && Math.abs(dc) === dr) {
    const step = dc > 0 ? COLS + 1 : COLS - 1;
    const diagonal: number[] = [];
    for (let k = a + step; k < b; k += step) diagonal.push(k);
    const blockers = liveAmong(diagonal);
    if (blockers.length < best.length) best = blockers;
  }

  return best;
}

/** Full pair check: both cells live, values match, and positions connect. */
export function isValidPair(board: Board, i: number, j: number): boolean {
  const a = board[i];
  const b = board[j];
  if (!isLive(a) || !isLive(b)) return false;
  return isMatchingValues(a.value, b.value) && canConnect(board, i, j);
}
