/**
 * Board mutations and status — implements docs/NUMBER_MATCH_RULES.md §4–§7.
 * All functions are pure: they return new boards and never mutate input.
 *
 * Every row occupies COLS slots; slots outside a row's width are holes (null).
 * See §13 and shapes.ts.
 */
import { COLS, MAX_CELLS } from './constants';
import { hasAnyMove } from './hint';
import { isValidPair } from './rules';
import { RECTANGLE, rowLayout, widthAt } from './shapes';
import { isLive, type Board, type BoardCell, type Digit, type GameStatus } from './types';

interface CollapseResult {
  readonly board: Board;
  readonly rowsRemoved: number;
  /** Playable slots the removed rows held — narrow rows are worth less (§12). */
  readonly rowCellsRemoved: number;
}

/**
 * §4: removes every row that no longer holds a live number, so the rows below
 * shift up. On a rectangular board this is the classic "a full row of nine
 * cleared cells disappears"; on a shaped board it is the same rule applied to
 * that row's own width.
 */
function collapseDetailed(board: Board): CollapseResult {
  const kept: BoardCell[] = [];
  let rowsRemoved = 0;
  let rowCellsRemoved = 0;
  const rows = Math.ceil(board.length / COLS);
  for (let r = 0; r < rows; r++) {
    const row = board.slice(r * COLS, (r + 1) * COLS);
    if (row.some((c) => isLive(c))) {
      kept.push(...row);
    } else {
      rowsRemoved++;
      rowCellsRemoved += row.filter((c) => c !== null).length;
    }
  }
  return { board: kept, rowsRemoved, rowCellsRemoved };
}

export function collapseBoard(board: Board): Board {
  return collapseDetailed(board).board;
}

export interface MatchResult {
  readonly board: Board;
  /** Rows removed by the collapse (feeds the score's row bonus). */
  readonly rowsRemoved: number;
  /** Playable slots those rows held. */
  readonly rowCellsRemoved: number;
}

/**
 * §4: clears a valid pair and collapses the board, reporting how many rows
 * disappeared. Returns null when the pair is not valid.
 */
export function applyMatchDetailed(board: Board, i: number, j: number): MatchResult | null {
  if (!isValidPair(board, i, j)) return null;
  const next = board.map((cell, idx) =>
    (idx === i || idx === j) && cell !== null ? { value: cell.value, cleared: true } : cell,
  );
  return collapseDetailed(next);
}

/** §4 convenience wrapper without the row count. */
export function applyMatch(board: Board, i: number, j: number): Board | null {
  return applyMatchDetailed(board, i, j)?.board ?? null;
}

function liveValues(board: Board): Digit[] {
  const values: Digit[] = [];
  for (const cell of board) if (isLive(cell)) values.push(cell.value);
  return values;
}

/**
 * §5: lays the given values into freshly shaped rows appended after
 * `startRow`. A row that runs out of values keeps holes for the rest, which
 * is what makes the last row look partially filled.
 */
function shapedRows(values: readonly Digit[], shape: readonly number[], startRow: number): BoardCell[] {
  const out: BoardCell[] = [];
  let placed = 0;
  for (let r = 0; placed < values.length; r++) {
    const layout = rowLayout(widthAt(shape, startRow + r));
    for (const playable of layout) {
      if (playable && placed < values.length) {
        out.push({ value: values[placed]!, cleared: false });
        placed++;
      } else {
        out.push(null);
      }
    }
  }
  return out;
}

/** Slots the appended rows would occupy (rows are always COLS wide). */
function appendedSlotCount(
  count: number,
  shape: readonly number[],
  startRow: number,
): number {
  let placed = 0;
  let rows = 0;
  while (placed < count) {
    placed += widthAt(shape, startRow + rows);
    rows++;
  }
  return rows * COLS;
}

/**
 * How many numbers still fit on the board's last row.
 *
 * A row that ran out of numbers keeps holes to its right; the next Add fills
 * those before starting a new row, so repeated Adds do not leave the board
 * riddled with permanent gaps. Rows are centred, so the playable band mirrors
 * the leading holes — that lets the band be recovered from the row itself,
 * which matters because collapsing rows shifts every row's index in the
 * shape cycle.
 */
function tailCapacity(board: Board): number {
  if (board.length === 0) return 0;
  const start = Math.floor((board.length - 1) / COLS) * COLS;
  const row = board.slice(start);
  const lead = row.findIndex((c) => c !== null);
  if (lead < 0) return 0;
  let last = -1;
  for (let i = row.length - 1; i >= 0; i--) {
    if (row[i] !== null) {
      last = i;
      break;
    }
  }
  return Math.max(0, COLS - 1 - lead - last);
}

/** §5: whether Add Numbers can currently be performed. */
export function canAddNumbers(
  board: Board,
  shape: readonly number[] = RECTANGLE,
  maxCells: number = MAX_CELLS,
): boolean {
  const values = liveValues(board);
  if (values.length === 0) return false;
  const overflow = Math.max(0, values.length - tailCapacity(board));
  const padded = Math.ceil(board.length / COLS) * COLS;
  return padded + appendedSlotCount(overflow, shape, padded / COLS) <= maxCells;
}

/**
 * §5: appends the remaining live numbers, in reading order — first into the
 * gap left on the last row, then as new shaped rows. Cleared cells are not
 * copied. Returns null when not allowed.
 */
export function addNumbers(
  board: Board,
  shape: readonly number[] = RECTANGLE,
  maxCells: number = MAX_CELLS,
): Board | null {
  if (!canAddNumbers(board, shape, maxCells)) return null;
  const values = liveValues(board);

  // Finish the last row before opening a new one, continuing straight after
  // its last cell (leading holes belong to the row's shape and stay).
  const filled: BoardCell[] = [...board];
  const capacity = Math.min(tailCapacity(board), values.length);
  const rowStart = Math.floor(Math.max(0, filled.length - 1) / COLS) * COLS;
  let lastCell = rowStart - 1;
  for (let i = rowStart; i < filled.length; i++) {
    if (filled[i] !== null) lastCell = i;
  }
  let placed = 0;
  while (placed < capacity) {
    const at = lastCell + 1 + placed;
    while (filled.length <= at) filled.push(null);
    filled[at] = { value: values[placed]!, cleared: false };
    placed++;
  }

  // Pad to a row boundary so any new rows stay aligned to the grid.
  while (filled.length % COLS !== 0) filled.push(null);
  const remaining = values.slice(placed);
  if (remaining.length === 0) return filled;
  return [...filled, ...shapedRows(remaining, shape, filled.length / COLS)];
}

/** §6–§7: current status of a board. */
export function getStatus(
  board: Board,
  shape: readonly number[] = RECTANGLE,
  maxCells: number = MAX_CELLS,
): GameStatus {
  if (!board.some((c) => isLive(c))) return 'cleared';
  if (hasAnyMove(board)) return 'playing';
  return canAddNumbers(board, shape, maxCells) ? 'playing' : 'gameOver';
}
