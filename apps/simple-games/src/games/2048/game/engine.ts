/**
 * One move, resolved (docs/GAME_2048_RULES.md §4), the new tile that follows
 * it (§5), and the test for a finished board (§2). Pure functions over a plain
 * array — no identity, no time, no randomness beyond the seed it is handed.
 *
 * `traceMove` is the whole implementation and `move` is a view of it. The
 * screen needs to know where each tile travelled to animate the slide (§12),
 * and a second traversal written for the animation would be a second set of
 * rules to keep in step with this one — the shape of bug where the board and
 * the picture of the board disagree.
 */
import { createRng } from './rng';
import {
  BOARD_SIZE,
  CELL_COUNT,
  colOf,
  rowOf,
  SPAWN_FOUR_CHANCE,
  type Board,
  type Direction,
} from './types';

/**
 * The cells of one row or column, ordered from the far side of the move
 * inwards: the first is where a tile would come to rest.
 */
function lineCells(direction: Direction, line: number): number[] {
  const cells: number[] = [];
  for (let step = 0; step < BOARD_SIZE; step++) {
    const far = BOARD_SIZE - 1 - step;
    if (direction === 'left') cells.push(line * BOARD_SIZE + step);
    else if (direction === 'right') cells.push(line * BOARD_SIZE + far);
    else if (direction === 'up') cells.push(step * BOARD_SIZE + line);
    else cells.push(far * BOARD_SIZE + line);
  }
  return cells;
}

interface LineOutcome {
  readonly values: readonly number[];
  readonly gained: number;
  /** Per source slot: the slot its tile ended in, or -1 when it held none. */
  readonly to: readonly number[];
  /** Per destination slot: whether this move merged the tile sitting there. */
  readonly merged: readonly boolean[];
}

/** Packs one line towards its head and merges neighbouring equals (§4). */
function collapseLine(line: readonly number[]): LineOutcome {
  const values: number[] = [];
  const to = new Array<number>(line.length).fill(-1);
  const merged = new Array<boolean>(line.length).fill(false);
  let gained = 0;

  const filled: number[] = [];
  for (let slot = 0; slot < line.length; slot++) if (line[slot] !== 0) filled.push(slot);

  for (let i = 0; i < filled.length; i++) {
    const slot = filled[i]!;
    const value = line[slot]!;
    const partner = filled[i + 1];
    const destination = values.length;

    if (partner !== undefined && line[partner] === value) {
      // The doubled tile is finished for this move — stepping past its partner
      // is what makes [2,2,4] into [4,4] rather than [8] (§4.3).
      const doubled = value * 2;
      values.push(doubled);
      gained += doubled;
      merged[destination] = true;
      to[slot] = destination;
      to[partner] = destination;
      i += 1;
    } else {
      values.push(value);
      to[slot] = destination;
    }
  }

  while (values.length < line.length) values.push(0);
  return { values, gained, to, merged };
}

export interface MoveTrace {
  readonly board: Board;
  /** The sum of the values this move created (§7). */
  readonly gained: number;
  /** False when the board is unchanged — the input does nothing (§3). */
  readonly moved: boolean;
  /** Per cell: where the tile that started there ended, or -1 for empty. */
  readonly to: readonly number[];
  /** Per cell: whether the tile now sitting there was merged into being. */
  readonly merged: readonly boolean[];
}

/** Resolves a move and reports how every tile got where it is (§4, §12). */
export function traceMove(board: Board, direction: Direction): MoveTrace {
  const next = [...board];
  const to = new Array<number>(CELL_COUNT).fill(-1);
  const merged = new Array<boolean>(CELL_COUNT).fill(false);
  let gained = 0;
  let moved = false;

  for (let line = 0; line < BOARD_SIZE; line++) {
    const cells = lineCells(direction, line);
    const outcome = collapseLine(cells.map((cell) => board[cell]!));
    gained += outcome.gained;

    for (let slot = 0; slot < BOARD_SIZE; slot++) {
      const cell = cells[slot]!;
      const value = outcome.values[slot]!;
      if (next[cell] !== value) moved = true;
      next[cell] = value;
      const destination = outcome.to[slot]!;
      if (destination >= 0) to[cell] = cells[destination]!;
      if (outcome.merged[slot]) merged[cell] = true;
    }
  }

  return { board: next, gained, moved, to, merged };
}

export interface MoveResult {
  readonly board: Board;
  readonly gained: number;
  readonly moved: boolean;
}

/** One move (§4). `moved: false` means the caller should do nothing (§3). */
export function move(board: Board, direction: Direction): MoveResult {
  const trace = traceMove(board, direction);
  return { board: trace.board, gained: trace.gained, moved: trace.moved };
}

export function emptyCells(board: Board): number[] {
  const cells: number[] = [];
  for (let cell = 0; cell < board.length; cell++) if (board[cell] === 0) cells.push(cell);
  return cells;
}

/**
 * Puts one new tile down (§5). The draw comes from the session's seed and how
 * many tiles have been spawned so far, never from `Math.random`, which is what
 * lets Undo hand the same tile back instead of rerolling it (§6).
 *
 * Returns the board untouched when there is nowhere to put it; a move that
 * changed the board always leaves a cell free, so that case is corruption
 * rather than play.
 */
export function spawnTile(board: Board, seed: string, spawnIndex: number): Board {
  const empties = emptyCells(board);
  if (empties.length === 0) return board;

  const rng = createRng(`${seed}:${spawnIndex}`);
  const cell = empties[Math.floor(rng() * empties.length)]!;
  const next = [...board];
  next[cell] = rng() < SPAWN_FOUR_CHANCE ? 4 : 2;
  return next;
}

/** Whether any of the four moves would change this board (§2). */
export function hasMoves(board: Board): boolean {
  for (let cell = 0; cell < board.length; cell++) {
    const value = board[cell]!;
    if (value === 0) return true;
    if (colOf(cell) < BOARD_SIZE - 1 && board[cell + 1] === value) return true;
    if (rowOf(cell) < BOARD_SIZE - 1 && board[cell + BOARD_SIZE] === value) return true;
  }
  return false;
}

/** Full board, nothing left to join: the one way this game ends (§2). */
export const isOver = (board: Board): boolean => !hasMoves(board);

export const hasTile = (board: Board, value: number): boolean => board.includes(value);
