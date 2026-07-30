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
import {
  hasLiveDigits,
  isDigit,
  isLive,
  type Board,
  type BoardCell,
  type Digit,
  type GameStatus,
} from './types';

interface CollapseResult {
  readonly board: Board;
  readonly rowsRemoved: number;
  /** Playable slots the removed rows held — narrow rows are worth less (§12). */
  readonly rowCellsRemoved: number;
}

/**
 * §4: removes every row that no longer holds a live cell, so the rows below
 * shift up. On a rectangular board this is the classic "a full row of nine
 * cleared cells disappears"; on a shaped board it is the same rule applied to
 * that row's own width.
 *
 * Stones are not live, so a row leaves with its stones once the numbers around
 * them are gone — the only way a stone ever leaves the board (§4). They count
 * towards `rowCellsRemoved` like any other slot: clearing a row around a stone
 * is harder, not worth less.
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
  // Spread rather than rebuild: a cleared wild has to stay a wild.
  const next = board.map((cell, idx) =>
    (idx === i || idx === j) && isLive(cell) ? { ...cell, cleared: true } : cell,
  );
  return collapseDetailed(next);
}

/** §4 convenience wrapper without the row count. */
export function applyMatch(board: Board, i: number, j: number): Board | null {
  return applyMatchDetailed(board, i, j)?.board ?? null;
}

/**
 * §5: the numbers Add Numbers copies. Wilds are left out on purpose — one is
 * placed when the board is generated and that is all the player ever gets, so
 * the choice of when to spend it holds its weight to the last move.
 */
function liveValues(board: Board): Digit[] {
  const values: Digit[] = [];
  for (const cell of board) if (isDigit(cell)) values.push(cell.value);
  return values;
}

/**
 * §5: lays the given values into plain full-width rows. Only the starting
 * board carries a shape (§13); a refill is a working surface, and appending
 * part of an outline would draw a figure with no beginning. A row that runs
 * out of values keeps holes for the rest — the next Add fills those first.
 */
function appendedRows(values: readonly Digit[]): BoardCell[] {
  const rows = Math.ceil(values.length / COLS);
  return Array.from({ length: rows * COLS }, (_, i) =>
    i < values.length ? { kind: 'digit' as const, value: values[i]!, cleared: false } : null,
  );
}

/**
 * How many numbers still fit on the board's last row.
 *
 * A row that ran out of numbers keeps holes to its right; the next Add fills
 * those before starting a new row, so repeated Adds do not leave the board
 * riddled with permanent gaps. Rows are centred, so the playable band mirrors
 * the leading holes, which is what lets the band be recovered from the row
 * itself — the starting shape is not carried around with the board.
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
export function canAddNumbers(board: Board, maxCells: number = MAX_CELLS): boolean {
  const values = liveValues(board);
  if (values.length === 0) return false;
  const overflow = Math.max(0, values.length - tailCapacity(board));
  const padded = Math.ceil(board.length / COLS) * COLS;
  return padded + Math.ceil(overflow / COLS) * COLS <= maxCells;
}

/**
 * §5: appends the remaining live numbers, in reading order — first into the
 * gap left on the last row, then as new full-width rows. Cleared cells are
 * not copied. Returns null when not allowed.
 */
export function addNumbers(board: Board, maxCells: number = MAX_CELLS): Board | null {
  if (!canAddNumbers(board, maxCells)) return null;
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
    filled[at] = { kind: 'digit', value: values[placed]!, cleared: false };
    placed++;
  }

  // Pad to a row boundary so any new rows stay aligned to the grid.
  while (filled.length % COLS !== 0) filled.push(null);
  const remaining = values.slice(placed);
  if (remaining.length === 0) return filled;
  return [...filled, ...appendedRows(remaining)];
}

/**
 * §6–§7: current status of a board.
 *
 * Clearing is measured in numbers, not in live cells: a wild left over once
 * every number is gone has nothing left to pair with and no way to be refilled
 * (§5), so counting it would turn a finished board into a dead end.
 */
export function getStatus(board: Board, maxCells: number = MAX_CELLS): GameStatus {
  if (!hasLiveDigits(board)) return 'cleared';
  if (hasAnyMove(board)) return 'playing';
  return canAddNumbers(board, maxCells) ? 'playing' : 'gameOver';
}
