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
  values: readonly Digit[],
  shape: readonly number[],
  startRow: number,
): number {
  let placed = 0;
  let rows = 0;
  while (placed < values.length) {
    placed += widthAt(shape, startRow + rows);
    rows++;
  }
  return rows * COLS;
}

/** §5: whether Add Numbers can currently be performed. */
export function canAddNumbers(
  board: Board,
  shape: readonly number[] = RECTANGLE,
  maxCells: number = MAX_CELLS,
): boolean {
  const values = liveValues(board);
  if (values.length === 0) return false;
  const padded = Math.ceil(board.length / COLS) * COLS;
  return padded + appendedSlotCount(values, shape, padded / COLS) <= maxCells;
}

/**
 * §5: appends the remaining live numbers, in reading order, as new shaped
 * rows. Cleared cells are not copied. Returns null when not allowed.
 */
export function addNumbers(
  board: Board,
  shape: readonly number[] = RECTANGLE,
  maxCells: number = MAX_CELLS,
): Board | null {
  if (!canAddNumbers(board, shape, maxCells)) return null;
  const values = liveValues(board);
  // Pad to a row boundary so the appended rows stay aligned to the grid.
  const padded: BoardCell[] = [...board];
  while (padded.length % COLS !== 0) padded.push(null);
  return [...padded, ...shapedRows(values, shape, padded.length / COLS)];
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
