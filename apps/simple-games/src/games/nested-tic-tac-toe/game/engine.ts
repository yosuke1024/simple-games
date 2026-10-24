/**
 * The rules, once (docs/NESTED_TIC_TAC_TOE_RULES.md §2, §3). The screen, the
 * CPU and the save loader all ask these functions what may be played — there
 * is no second, faster copy for the search (§4).
 *
 * A position is one mutable record: the 81 marks, the nine small boards'
 * states, and the move list. The move list is part of the position because
 * the marks alone do not say which small board the next move goes to — the
 * last move does (§1, §2). The search plays and takes back moves on the same
 * record (`makeMove` / `unmakeMove`) instead of building boards; everything
 * outside the search treats positions as values and replays move lists
 * (`positionFromMoves`), which costs at most 81 moves.
 *
 * Taking a move back needs no saved state: a move is only ever made into an
 * OPEN small board of a position that has not finished (§2 4, §3), so after
 * it is undone that board is open again and the match is ongoing again.
 */
import {
  BOARD_COUNT,
  boardOf,
  CELL_COUNT,
  CELLS_PER_BOARD,
  cellOf,
  DRAWN,
  EMPTY,
  LINES_THROUGH,
  markToMove,
  ONGOING,
  OPEN,
  placeOf,
  type Mark,
  type Result,
} from './types';

export interface Position {
  /** 0 empty, 1 cross, 2 circle — indexed `9·b + c` (§1). */
  readonly cells: Int8Array;
  /** OPEN / CROSS / CIRCLE (taken by) / DRAWN, per small board (§1). */
  readonly smalls: Int8Array;
  /** Marks in each small board, so "full" costs nothing to ask. */
  readonly filled: Int8Array;
  /** Every move so far, oldest first. The turn and the send derive from it (§1). */
  readonly moves: number[];
  /** ONGOING until a big-board line (cross / circle) or the last board closing without one (DRAWN) — §3. */
  result: Result;
}

/** The one starting position: an empty board, cross to move (§1). */
export function newPosition(): Position {
  return {
    cells: new Int8Array(CELL_COUNT),
    smalls: new Int8Array(BOARD_COUNT),
    filled: new Int8Array(BOARD_COUNT),
    moves: [],
    result: ONGOING,
  };
}

export function clonePosition(position: Position): Position {
  return {
    cells: position.cells.slice(),
    smalls: position.smalls.slice(),
    filled: position.filled.slice(),
    moves: [...position.moves],
    result: position.result,
  };
}

/** The side to move — meaningless once the match has a result (§1). */
export const toMove = (position: Position): Mark => markToMove(position.moves.length);

export const isOver = (position: Position): boolean => position.result !== ONGOING;

/**
 * The small board the side to move is sent to (§2 2): the place, inside its
 * small board, of the last move. Null on the first move, and null when that
 * board is closed — a free move (§2 3).
 */
export function sendTarget(position: Position): number | null {
  const { moves } = position;
  if (moves.length === 0) return null;
  const target = placeOf(moves[moves.length - 1]!);
  return position.smalls[target] === OPEN ? target : null;
}

/** True when the side to move may play in any open small board (§2 1, §2 3). */
export const isFreeMove = (position: Position): boolean =>
  position.result === ONGOING && sendTarget(position) === null;

/**
 * The small boards the side to move may play in, ascending: the one it was
 * sent to, or every open board on a free move, or none once the match is
 * over (§2). This is what the screen frames (§10).
 */
export function playableBoards(position: Position): number[] {
  if (position.result !== ONGOING) return [];
  const target = sendTarget(position);
  if (target !== null) return [target];
  const boards: number[] = [];
  for (let board = 0; board < BOARD_COUNT; board++) {
    if (position.smalls[board] === OPEN) boards.push(board);
  }
  return boards;
}

/**
 * Every legal move, ascending by cell (§2). Empty once the match is over —
 * even with open small boards left after a big-board line. Otherwise never
 * empty: an open small board always has an empty cell, because a full one
 * is closed (§2 6).
 */
export function legalMoves(position: Position): number[] {
  const moves: number[] = [];
  for (const board of playableBoards(position)) {
    for (let place = 0; place < CELLS_PER_BOARD; place++) {
      const cell = cellOf(board, place);
      if (position.cells[cell] === EMPTY) moves.push(cell);
    }
  }
  return moves;
}

/**
 * True when `cell` is one of `legalMoves` (§2). Not a second statement of the
 * rules: past the range check it only asks `legalMoves`, so the screen, the
 * save replay and the search cannot disagree about what may be played. At
 * most 81 cells, and never called inside the search.
 */
export function isLegalMove(position: Position, cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= CELL_COUNT) return false;
  return legalMoves(position).includes(cell);
}

/**
 * True when `mark` on the empty `cell` would complete a line in its small
 * board — that is, take the board (§2 5). Asks; changes nothing.
 */
export function wouldTake(position: Position, cell: number, mark: Mark): boolean {
  const { cells } = position;
  const base = cell - placeOf(cell);
  for (const [a, b, c] of LINES_THROUGH[placeOf(cell)]!) {
    const first = base + a === cell ? mark : cells[base + a];
    const second = base + b === cell ? mark : cells[base + b];
    const third = base + c === cell ? mark : cells[base + c];
    if (first === mark && second === mark && third === mark) return true;
  }
  return false;
}

/**
 * Plays `cell` for the side to move and settles what it did (§2 5–6, §3):
 * a line takes the small board — before "full" is looked at, so the ninth
 * mark that makes a line takes rather than draws; a taken board that
 * completes a big-board line wins on the spot; the last board closing
 * without one draws.
 *
 * Unchecked — the caller passes a legal move (`isLegalMove`). The search
 * only ever plays moves `legalMoves` gave it; everything else goes through
 * `playMove`.
 */
export function makeMove(position: Position, cell: number): void {
  const mark = toMove(position);
  const board = boardOf(cell);
  position.cells[cell] = mark;
  position.filled[board] = position.filled[board]! + 1;
  position.moves.push(cell);

  if (wouldTake(position, cell, mark)) {
    position.smalls[board] = mark;
    for (const [a, b, c] of LINES_THROUGH[board]!) {
      if (
        position.smalls[a] === mark &&
        position.smalls[b] === mark &&
        position.smalls[c] === mark
      ) {
        position.result = mark;
        return;
      }
    }
  } else if (position.filled[board] === CELLS_PER_BOARD) {
    position.smalls[board] = DRAWN;
  } else {
    return;
  }

  for (let other = 0; other < BOARD_COUNT; other++) {
    if (position.smalls[other] === OPEN) return;
  }
  position.result = DRAWN;
}

/** Takes the last move back — the exact inverse of `makeMove` (see the file comment). */
export function unmakeMove(position: Position): void {
  const cell = position.moves.pop();
  if (cell === undefined) return;
  const board = boardOf(cell);
  position.cells[cell] = EMPTY;
  position.filled[board] = position.filled[board]! - 1;
  position.smalls[board] = OPEN;
  position.result = ONGOING;
}

/** Plays `cell` if it is legal; false (and nothing changed) otherwise. */
export function playMove(position: Position, cell: number): boolean {
  if (!isLegalMove(position, cell)) return false;
  makeMove(position, cell);
  return true;
}

/**
 * Replays a move list from the empty board, checking every move against the
 * position before it (§8.2): each must be in that position's `legalMoves`.
 * Null at the first move that was not — a filled cell, a closed board, a
 * board it was not sent to, or any move after the match had finished (the
 * finished position has no legal moves). A list longer than 81 is refused
 * before any of it is read: no legal list is that long (§3 5), and a huge
 * array should cost nothing to reject.
 */
export function positionFromMoves(moves: readonly number[]): Position | null {
  if (moves.length > CELL_COUNT) return null;
  const position = newPosition();
  for (const cell of moves) {
    if (!playMove(position, cell)) return null;
  }
  return position;
}

/**
 * The big-board line that won, as three small-board indexes, or null (§3 1,
 * §10). One line only: when the winning move completes two at once (the
 * centre board finishing a row and a diagonal, say), the first in `LINES`
 * order — the screen outlines that one (§10).
 */
export function winningLine(position: Position): readonly [number, number, number] | null {
  const { result, moves } = position;
  if (result === ONGOING || result === DRAWN) return null;
  // The winning line runs through the board the last move took.
  const board = boardOf(moves[moves.length - 1]!);
  for (const line of LINES_THROUGH[board]!) {
    if (line.every((small) => position.smalls[small] === result)) return line;
  }
  return null;
}

/** Small boards `mark` has taken — the result card's "you n – CPU m" (§7). */
export function takenCount(position: Position, mark: Mark): number {
  let count = 0;
  for (let board = 0; board < BOARD_COUNT; board++) {
    if (position.smalls[board] === mark) count += 1;
  }
  return count;
}
