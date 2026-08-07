/**
 * One move, resolved (docs/CHECKERS_RULES.md §2, §3). Pure functions over a
 * plain array — no identity, no time, no randomness.
 *
 * The rule that shapes everything here is the capture obligation: when a
 * capture exists anywhere on the board, the quiet moves are not moves at all
 * (§2). So there is one generator, `collectMoves`, and it answers with the
 * jumps whenever there are any — callers never have to remember to check,
 * and the CPU and the screen cannot end up disagreeing about what is legal.
 *
 * A move here is one *step*. A turn may be several of them: landing from a
 * jump with another jump available means the same piece must go on (§2). The
 * caller drives that with `continueFrom`, which narrows the generator to one
 * piece's jumps — the session uses it to hold a sequence together, and the
 * search uses it to read a sequence without spending a ply.
 *
 * Moves are packed into one integer so the search can hold move lists in
 * buffers allocated once per turn rather than an array per node.
 */
import {
  COLS,
  EMPTY,
  PLAYER,
  ROWS,
  cellAt,
  colOf,
  isKing,
  kingOf,
  promotionRowOf,
  rowOf,
  sideOf,
  type Board,
  type Piece,
  type Side,
} from './types';

/** A quiet move captures nothing; the packed form stores that as 0. */
export const NO_CAPTURE = -1;

/** from (6 bits) | to (6 bits) | captured + 1 (7 bits). */
export const packMove = (from: number, to: number, captured: number): number =>
  from | (to << 6) | ((captured + 1) << 12);

export const moveFrom = (move: number): number => move & 0x3f;
export const moveTo = (move: number): number => (move >> 6) & 0x3f;
export const moveCaptured = (move: number): number => ((move >> 12) & 0x7f) - 1;
export const isCapture = (move: number): boolean => moveCaptured(move) !== NO_CAPTURE;

export interface Move {
  readonly from: number;
  readonly to: number;
  /** The cell of the piece jumped over, or -1 for a quiet move (§2). */
  readonly captured: number;
}

export const unpackMove = (move: number): Move => ({
  from: moveFrom(move),
  to: moveTo(move),
  captured: moveCaptured(move),
});

/**
 * The four diagonals, as parallel (row, col) steps. Kept as two flat arrays
 * and walked by index: the generators run at every node of the CPU's search,
 * and iterating an array of pairs there allocates an iterator and a
 * destructuring pair per direction per piece.
 *
 * The first two are the CPU's forward pair and the last two the player's, so
 * a man can take a contiguous slice instead of testing each direction.
 */
const DR = new Int8Array([1, 1, -1, -1]);
const DC = new Int8Array([-1, 1, -1, 1]);
/** Index range in DR/DC for a man of each side: [start, end). */
const CPU_FORWARD_START = 0;
const PLAYER_FORWARD_START = 2;
const DIRECTION_COUNT = 4;

/** Enough for any position: 12 pieces with at most 4 destinations each. */
export const MAX_MOVES = 48;

const inBounds = (row: number, col: number): boolean =>
  row >= 0 && row < ROWS && col >= 0 && col < COLS;

/**
 * Every jump the piece on `cell` can make. Returns how many were written.
 * A man jumps only forward; a king in all four diagonals (§2).
 */
function collectJumpsFrom(
  board: ArrayLike<number>,
  cell: number,
  side: Side,
  out: Int32Array,
  at: number,
): number {
  const piece = board[cell] as Piece;
  if (sideOf(piece) !== side) return 0;
  const king = isKing(piece);
  const row = rowOf(cell);
  const col = colOf(cell);
  const start = king ? 0 : side === PLAYER ? PLAYER_FORWARD_START : CPU_FORWARD_START;
  const end = king ? DIRECTION_COUNT : start + 2;

  let count = 0;
  for (let d = start; d < end; d++) {
    const dr = DR[d]!;
    const dc = DC[d]!;
    const landRow = row + dr * 2;
    const landCol = col + dc * 2;
    if (!inBounds(landRow, landCol)) continue;
    const mid = cellAt(row + dr, col + dc);
    const midSide = sideOf(board[mid] as Piece);
    if (midSide === null || midSide === side) continue;
    const land = cellAt(landRow, landCol);
    if (board[land] !== EMPTY) continue;
    out[at + count] = packMove(cell, land, mid);
    count += 1;
  }
  return count;
}

/** Every quiet step the piece on `cell` can make (§2). */
function collectQuietFrom(
  board: ArrayLike<number>,
  cell: number,
  side: Side,
  out: Int32Array,
  at: number,
): number {
  const piece = board[cell] as Piece;
  if (sideOf(piece) !== side) return 0;
  const king = isKing(piece);
  const row = rowOf(cell);
  const col = colOf(cell);
  const start = king ? 0 : side === PLAYER ? PLAYER_FORWARD_START : CPU_FORWARD_START;
  const end = king ? DIRECTION_COUNT : start + 2;

  let count = 0;
  for (let d = start; d < end; d++) {
    const toRow = row + DR[d]!;
    const toCol = col + DC[d]!;
    if (!inBounds(toRow, toCol)) continue;
    const to = cellAt(toRow, toCol);
    if (board[to] !== EMPTY) continue;
    out[at + count] = packMove(cell, to, NO_CAPTURE);
    count += 1;
  }
  return count;
}

/**
 * The legal moves for `side`, written into `out`; returns how many.
 *
 * With `continueFrom` set to a cell, this is a sequence in progress and only
 * that piece's jumps are legal (§2). Otherwise the capture obligation
 * decides: any jump on the board means the quiet moves are not generated at
 * all.
 */
export function collectMoves(
  board: ArrayLike<number>,
  side: Side,
  continueFrom: number,
  out: Int32Array,
): number {
  if (continueFrom >= 0) return collectJumpsFrom(board, continueFrom, side, out, 0);

  // Only the dark squares can hold anything (§1), so both sweeps step two at
  // a time along each rank instead of testing all sixty-four cells.
  let jumps = 0;
  for (let row = 0; row < ROWS; row++) {
    const base = row * COLS;
    for (let col = 1 - (row % 2); col < COLS; col += 2) {
      const cell = base + col;
      if (board[cell] === EMPTY) continue;
      if (sideOf(board[cell] as Piece) !== side) continue;
      jumps += collectJumpsFrom(board, cell, side, out, jumps);
    }
  }
  if (jumps > 0) return jumps;

  let quiet = 0;
  for (let row = 0; row < ROWS; row++) {
    const base = row * COLS;
    for (let col = 1 - (row % 2); col < COLS; col += 2) {
      const cell = base + col;
      if (board[cell] === EMPTY) continue;
      if (sideOf(board[cell] as Piece) !== side) continue;
      quiet += collectQuietFrom(board, cell, side, out, quiet);
    }
  }
  return quiet;
}

/** The legal moves for `side`, as objects. The screen's and session's view. */
export function legalMoves(board: Board, side: Side, continueFrom: number | null = null): Move[] {
  const buffer = new Int32Array(MAX_MOVES);
  const count = collectMoves(board, side, continueFrom ?? NO_CAPTURE, buffer);
  const moves: Move[] = [];
  for (let i = 0; i < count; i++) moves.push(unpackMove(buffer[i]!));
  return moves;
}

/**
 * Whether `side` has anything to play. A side with no legal move has lost
 * (§3) — being shut in is the same as being wiped out.
 */
export function hasAnyMove(board: Board, side: Side): boolean {
  const buffer = new Int32Array(MAX_MOVES);
  return collectMoves(board, side, NO_CAPTURE, buffer) > 0;
}

/** True when a capture is available anywhere for `side` (§2). */
export function mustCapture(board: Board, side: Side): boolean {
  const buffer = new Int32Array(MAX_MOVES);
  const count = collectMoves(board, side, NO_CAPTURE, buffer);
  return count > 0 && isCapture(buffer[0]!);
}

export interface AppliedStep {
  readonly board: Board;
  /** True when this step crowned a man — which ends the turn (§2). */
  readonly promoted: boolean;
  /**
   * The cell the same piece must jump from next, or null when the turn is
   * over: a quiet move, a crowning, or a jump with nothing left to take (§2).
   */
  readonly continueFrom: number | null;
}

/**
 * Plays one step. The caller is expected to have taken `move` from
 * `legalMoves`, so this does not re-check legality — it applies it.
 *
 * Crowning happens on arrival and ends the turn even when the new king could
 * jump on; that is the English rule, and it is the one place where a capture
 * sequence stops early (§2, §11).
 */
export function applyStep(board: Board, move: Move): AppliedStep {
  const next: Piece[] = [...board];
  const piece = next[move.from]!;
  const side = sideOf(piece)!;

  next[move.from] = EMPTY;
  if (move.captured !== NO_CAPTURE) next[move.captured] = EMPTY;

  const promoted = !isKing(piece) && rowOf(move.to) === promotionRowOf(side);
  next[move.to] = promoted ? kingOf(side) : piece;

  if (move.captured === NO_CAPTURE || promoted) {
    return { board: next, promoted, continueFrom: null };
  }
  return {
    board: next,
    promoted,
    continueFrom: hasJumpFrom(next, move.to, side) ? move.to : null,
  };
}

/**
 * Whether the piece on `cell` can jump again — the question that decides
 * whether a turn goes on (§2). Allocates nothing: the search asks it once per
 * capture it makes.
 */
export function hasJumpFrom(board: ArrayLike<number>, cell: number, side: Side): boolean {
  const piece = board[cell] as Piece;
  if (sideOf(piece) !== side) return false;
  const king = isKing(piece);
  const row = rowOf(cell);
  const col = colOf(cell);
  const start = king ? 0 : side === PLAYER ? PLAYER_FORWARD_START : CPU_FORWARD_START;
  const end = king ? DIRECTION_COUNT : start + 2;

  for (let d = start; d < end; d++) {
    const dr = DR[d]!;
    const dc = DC[d]!;
    const landRow = row + dr * 2;
    const landCol = col + dc * 2;
    if (!inBounds(landRow, landCol)) continue;
    const midSide = sideOf(board[cellAt(row + dr, col + dc)] as Piece);
    if (midSide === null || midSide === side) continue;
    if (board[cellAt(landRow, landCol)] !== EMPTY) continue;
    return true;
  }
  return false;
}

/** One complete turn: the steps it is made of, and the board it leaves. */
export interface Turn {
  readonly steps: readonly Move[];
  readonly board: Board;
}

function walkTurn(board: Board, side: Side, move: Move, prefix: Move[], out: Turn[]): void {
  const outcome = applyStep(board, move);
  const steps = [...prefix, move];
  if (outcome.continueFrom === null) {
    out.push({ steps, board: outcome.board });
    return;
  }
  for (const next of legalMoves(outcome.board, side, outcome.continueFrom)) {
    walkTurn(outcome.board, side, next, steps, out);
  }
}

/**
 * Every complete turn `side` could play, sequences expanded (§2). One entry
 * per way the turn could end, which is what the CPU chooses between and what
 * the screen then plays out jump by jump.
 *
 * `continueFrom` enumerates the rest of a turn already half-played, which is
 * what a match restored in the middle of a forced sequence needs (§8).
 */
export function enumerateTurns(
  board: Board,
  side: Side,
  continueFrom: number | null = null,
): Turn[] {
  const out: Turn[] = [];
  for (const move of legalMoves(board, side, continueFrom)) {
    walkTurn(board, side, move, [], out);
  }
  return out;
}

/**
 * Whether this step leaves the counter that decides a draw untouched (§3).
 * Only a king's quiet move does: a capture changes the material and a man's
 * move is progress towards a crowning, so both reset it.
 */
export function isQuietKingStep(board: Board, move: Move): boolean {
  if (move.captured !== NO_CAPTURE) return false;
  return isKing(board[move.from]!);
}
