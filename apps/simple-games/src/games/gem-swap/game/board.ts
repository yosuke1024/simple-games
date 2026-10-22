/**
 * Runs, swaps and gravity on a board (docs/GEM_SWAP_RULES.md §1, §4).
 *
 * Everything here is a pure function of the board it is given. Nothing reads
 * a seed: refills live in resolve.ts, where the tapes are.
 */
import {
  ADJACENT_PAIR_COUNT,
  BOARD_SIZE,
  CELL_COUNT,
  EMPTY,
  colOf,
  indexAt,
  isAdjacent,
  normaliseSwap,
  rowOf,
  type Board,
  type Swap,
} from './types';

/** One run: three or more of a kind in a row or column (§1). */
export interface Run {
  readonly kind: number;
  readonly orientation: 'row' | 'column';
  /** Cell indices along the run, in reading order. */
  readonly cells: readonly number[];
}

/**
 * Every maximal run on the board — a run of five is one run, not three. Runs
 * that cross (L, T, plus) are both listed; `clearedCells` is where the
 * crossing cell is counted once.
 */
export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    let start = 0;
    for (let col = 1; col <= BOARD_SIZE; col++) {
      const kind = board[indexAt(row, start)]!;
      if (col < BOARD_SIZE && board[indexAt(row, col)] === kind) continue;
      if (kind !== EMPTY && col - start >= 3) {
        const cells: number[] = [];
        for (let c = start; c < col; c++) cells.push(indexAt(row, c));
        runs.push({ kind, orientation: 'row', cells });
      }
      start = col;
    }
  }
  for (let col = 0; col < BOARD_SIZE; col++) {
    let start = 0;
    for (let row = 1; row <= BOARD_SIZE; row++) {
      const kind = board[indexAt(start, col)]!;
      if (row < BOARD_SIZE && board[indexAt(row, col)] === kind) continue;
      if (kind !== EMPTY && row - start >= 3) {
        const cells: number[] = [];
        for (let r = start; r < row; r++) cells.push(indexAt(r, col));
        runs.push({ kind, orientation: 'column', cells });
      }
      start = row;
    }
  }
  return runs;
}

/**
 * The union of every run's cells, ascending: what one stage clears (§1). An
 * L / T / plus intersection appears once, so `.length` is the stage's score.
 */
export function clearedCells(board: Board): number[] {
  const marked = new Array<boolean>(CELL_COUNT).fill(false);
  for (const run of findRuns(board)) for (const cell of run.cells) marked[cell] = true;
  const out: number[] = [];
  for (let i = 0; i < CELL_COUNT; i++) if (marked[i]) out.push(i);
  return out;
}

export const hasRun = (board: Board): boolean => findRuns(board).length > 0;

/** Length of the same-kind line through `index` along one axis. */
function lineLength(board: Board, index: number, dRow: number, dCol: number): number {
  const kind = board[index];
  if (kind === undefined || kind === EMPTY) return 0;
  const row = rowOf(index);
  const col = colOf(index);
  let length = 1;
  for (const sign of [1, -1]) {
    let r = row + sign * dRow;
    let c = col + sign * dCol;
    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[indexAt(r, c)] === kind) {
      length++;
      r += sign * dRow;
      c += sign * dCol;
    }
  }
  return length;
}

/** Does a run of three or more pass through this cell? */
export function makesRunAt(board: Board, index: number): boolean {
  return lineLength(board, index, 0, 1) >= 3 || lineLength(board, index, 1, 0) >= 3;
}

/** The board with the two cells' gems exchanged. */
export function swapCells(board: Board, a: number, b: number): Board {
  const next = [...board];
  next[a] = board[b]!;
  next[b] = board[a]!;
  return next;
}

/**
 * The rules' definition of a valid swap (§1): the two cells are neighbours,
 * hold different kinds, and the exchanged board has a run.
 *
 * Swaps are only ever made on a settled board — the initial board has no run
 * (§4.1), every resolution ends settled or ends the round (§4.4) — and on a
 * settled board any run the swap creates must pass through one of the two
 * cells. So the local check at those two cells is exactly the rule, at a
 * fraction of a full scan's cost.
 */
export function isValidSwap(board: Board, a: number, b: number): boolean {
  if (!isAdjacent(a, b)) return false;
  if (board[a] === board[b]) return false;
  const swapped = swapCells(board, a, b);
  return makesRunAt(swapped, a) || makesRunAt(swapped, b);
}

/** All 112 adjacent pairs, in a fixed order: horizontal pairs row by row, then vertical. */
export const ADJACENT_PAIRS: readonly Swap[] = (() => {
  const pairs: Swap[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col + 1 < BOARD_SIZE; col++) {
      pairs.push(normaliseSwap(indexAt(row, col), indexAt(row, col + 1)));
    }
  }
  for (let row = 0; row + 1 < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      pairs.push(normaliseSwap(indexAt(row, col), indexAt(row + 1, col)));
    }
  }
  if (pairs.length !== ADJACENT_PAIR_COUNT) throw new Error('adjacent pair count');
  return pairs;
})();

/**
 * Every valid swap on the board, in ADJACENT_PAIRS order. The game never shows
 * this list (no hints — §6); the round uses it only to ask "is there any?",
 * and the tests and the auto-play measurement use it whole.
 */
export function validSwaps(board: Board): Swap[] {
  return ADJACENT_PAIRS.filter(([a, b]) => isValidSwap(board, a, b));
}

/** Stuck is the absence of any valid swap (§1). Stops at the first one found. */
export function hasValidSwap(board: Board): boolean {
  for (const [a, b] of ADJACENT_PAIRS) if (isValidSwap(board, a, b)) return true;
  return false;
}

/** A gem that slid down during gravity: from one cell to a lower one in its column. */
export interface Drop {
  readonly from: number;
  readonly to: number;
}

/**
 * Gravity on a board with EMPTY cells: in every column the surviving gems
 * slide down, keeping their order, and the empties collect at the top.
 * Returns the compacted board (EMPTY at the top of columns), the moves, and
 * how many cells each column now needs from its tape.
 */
export function applyGravity(board: Board): {
  board: Board;
  drops: Drop[];
  emptyPerColumn: number[];
} {
  const next = [...board];
  const drops: Drop[] = [];
  const emptyPerColumn: number[] = [];
  for (let col = 0; col < BOARD_SIZE; col++) {
    let write = BOARD_SIZE - 1;
    for (let row = BOARD_SIZE - 1; row >= 0; row--) {
      const from = indexAt(row, col);
      const kind = board[from]!;
      if (kind === EMPTY) continue;
      const to = indexAt(write, col);
      if (to !== from) drops.push({ from, to });
      next[to] = kind;
      write--;
    }
    for (let row = write; row >= 0; row--) next[indexAt(row, col)] = EMPTY;
    emptyPerColumn.push(write + 1);
  }
  return { board: next, drops, emptyPerColumn };
}
