/**
 * Board mutations and status — implements docs/NUMBER_MATCH_RULES.md §4–§7.
 * All functions are pure: they return new boards and never mutate input.
 */
import { COLS, MAX_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { isValidPair } from './rules';
import type { Board, Cell, GameStatus } from './types';

interface CollapseResult {
  readonly board: Board;
  readonly rowsRemoved: number;
}

/**
 * §4: removes complete rows (COLS cells) that are fully cleared, then trims
 * trailing cleared cells at the end of the board. Counts removed rows
 * directly (trailing trim must not be mistaken for a row removal).
 */
function collapseDetailed(board: Board): CollapseResult {
  const kept: Cell[] = [];
  let rowsRemoved = 0;
  const fullRows = Math.floor(board.length / COLS);
  for (let r = 0; r < fullRows; r++) {
    const row = board.slice(r * COLS, (r + 1) * COLS);
    if (row.every((c) => c.cleared)) {
      rowsRemoved++;
    } else {
      kept.push(...row);
    }
  }
  kept.push(...board.slice(fullRows * COLS));
  while (kept.length > 0 && kept[kept.length - 1]!.cleared) kept.pop();
  return { board: kept, rowsRemoved };
}

export function collapseBoard(board: Board): Board {
  return collapseDetailed(board).board;
}

export interface MatchResult {
  readonly board: Board;
  /** Complete rows removed by the collapse (feeds the score's row bonus). */
  readonly rowsRemoved: number;
}

/**
 * §4: clears a valid pair and collapses the board, reporting how many
 * complete rows disappeared. Returns null when the pair is not valid.
 */
export function applyMatchDetailed(board: Board, i: number, j: number): MatchResult | null {
  if (!isValidPair(board, i, j)) return null;
  const next = board.map((cell, idx) =>
    idx === i || idx === j ? { value: cell.value, cleared: true } : cell,
  );
  const { board: collapsed, rowsRemoved } = collapseDetailed(next);
  return { board: collapsed, rowsRemoved };
}

/** §4 convenience wrapper without the row count. */
export function applyMatch(board: Board, i: number, j: number): Board | null {
  return applyMatchDetailed(board, i, j)?.board ?? null;
}

/** §5: whether Add Numbers can currently be performed. */
export function canAddNumbers(board: Board, maxCells: number = MAX_CELLS): boolean {
  const liveCount = board.reduce((n, c) => (c.cleared ? n : n + 1), 0);
  if (liveCount === 0) return false;
  return board.length + liveCount <= maxCells;
}

/**
 * §5: appends the remaining live numbers, in reading order, to the end of the
 * board. Cleared cells are not copied. Returns null when not allowed.
 */
export function addNumbers(board: Board, maxCells: number = MAX_CELLS): Board | null {
  if (!canAddNumbers(board, maxCells)) return null;
  const appended: Cell[] = board
    .filter((c) => !c.cleared)
    .map((c) => ({ value: c.value, cleared: false }));
  return [...board, ...appended];
}

/** §6–§7: current status of a board. */
export function getStatus(board: Board, maxCells: number = MAX_CELLS): GameStatus {
  const anyLive = board.some((c) => !c.cleared);
  if (!anyLive) return 'cleared';
  if (hasAnyMove(board)) return 'playing';
  return canAddNumbers(board, maxCells) ? 'playing' : 'gameOver';
}
