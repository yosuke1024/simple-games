/**
 * The board rules of docs/UNBLOCK_PUZZLE_RULES.md §1–§4: what a legal board
 * is, how far a block can slide, what one slide does, and the win. Pure
 * functions over a block list and a position list — no cell objects, no
 * state, nothing to keep in sync.
 *
 * Every other layer reads the rules from here: the search (search.ts) is
 * checked against these functions by its tests, the session (session.ts)
 * refuses any move `isLegalSlide` refuses, and a save is only restored if
 * every move it holds replays through `slide` (serialize.ts).
 */
import {
  BOARD_SIZE,
  CELL_COUNT,
  EXIT_POSITION,
  MAX_BLOCKS,
  TARGET_INDEX,
  TARGET_ROW,
  cellAt,
  isTargetShape,
  maxOffset,
  type Block,
  type Board,
  type Slide,
} from './types';

/** No block on the cell. */
export const EMPTY = -1;

/**
 * Which block covers each cell, row-major, or EMPTY. Null when two blocks
 * overlap or one leaves the board — a board that is not a board.
 */
export function occupancy(board: Board): Int8Array | null {
  const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
  for (let index = 0; index < board.blocks.length; index++) {
    const block = board.blocks[index]!;
    const position = board.positions[index];
    if (position === undefined || !Number.isInteger(position)) return null;
    if (position < 0 || position > maxOffset(block.length)) return null;
    for (let k = 0; k < block.length; k++) {
      const cell = cellAt(block, position, k);
      if (cells[cell] !== EMPTY) return null;
      cells[cell] = index;
    }
  }
  return cells;
}

/** Whether one block description is a block this game can hold (§1). */
export function isValidBlock(block: Block): boolean {
  return (
    (block.orientation === 'h' || block.orientation === 'v') &&
    (block.length === 2 || block.length === 3) &&
    Number.isInteger(block.lane) &&
    block.lane >= 0 &&
    block.lane < BOARD_SIZE
  );
}

/**
 * Whether a board keeps every structural rule of §1: the target first and
 * shaped as the target, at most 16 blocks of length 2 or 3 on the grid, no overlap,
 * and no other horizontal block in the target's row. The last one is a rule
 * of the boards this game deals, not of physics, and a deliberate narrowing
 * of the blocks the puzzle allows (§16): a horizontal block right of the
 * target would wall the exit off for good, and one left of it would stop
 * vertical blocks from crossing the row in those columns — it can change the
 * fewest moves, or leave no way out. Leaving both out keeps the boards dealt
 * simple to reason about, and a save holding one cannot have come from play
 * (§12).
 */
export function isValidBoard(board: Board): boolean {
  const { blocks, positions } = board;
  if (blocks.length < 1 || blocks.length > MAX_BLOCKS) return false;
  if (positions.length !== blocks.length) return false;
  if (!isTargetShape(blocks[TARGET_INDEX]!)) return false;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]!;
    if (!isValidBlock(block)) return false;
    if (index !== TARGET_INDEX && block.orientation === 'h' && block.lane === TARGET_ROW) {
      return false;
    }
  }
  return occupancy(board) !== null;
}

/** The win (§3): the target's right cell is against the exit. */
export const isSolved = (board: Board): boolean => board.positions[TARGET_INDEX] === EXIT_POSITION;

export interface SlideRange {
  /** The lowest offset the block can reach from here in one slide. */
  readonly min: number;
  /** The highest. */
  readonly max: number;
}

/**
 * How far one block can slide along its lane before it meets another block or
 * the edge (§4). The block's own offset is always inside the range; a block
 * boxed in on both sides has `min === max`.
 */
export function slideRange(board: Board, index: number, cells?: Int8Array): SlideRange {
  const occupied = cells ?? occupancy(board);
  const block = board.blocks[index];
  const position = board.positions[index];
  if (occupied === null || block === undefined || position === undefined) {
    return { min: position ?? 0, max: position ?? 0 };
  }
  let min = position;
  while (min > 0 && occupied[cellAt(block, min - 1, 0)] === EMPTY) min--;
  let max = position;
  while (
    max < maxOffset(block.length) &&
    occupied[cellAt(block, max + 1, block.length - 1)] === EMPTY
  ) {
    max++;
  }
  return { min, max };
}

/**
 * Whether one slide is legal (§4): a real block, a different offset, and every
 * cell between here and there free. Sliding through another block, off the
 * board or across the lane is not a move.
 */
export function isLegalSlide(board: Board, move: Slide): boolean {
  const position = board.positions[move.block];
  if (position === undefined || !Number.isInteger(move.to) || move.to === position) return false;
  const range = slideRange(board, move.block);
  return move.to >= range.min && move.to <= range.max;
}

/** The board after one slide, or null when the slide is not legal. */
export function slide(board: Board, move: Slide): Board | null {
  if (!isLegalSlide(board, move)) return null;
  const positions = [...board.positions];
  positions[move.block] = move.to;
  return { blocks: board.blocks, positions };
}

/**
 * Every legal slide from a board, block by block in index order, nearest
 * offset first in each direction (left / up before right / down). The order
 * is what makes the Hint deterministic when two first moves are equally
 * short (§6).
 */
export function legalSlides(board: Board): Slide[] {
  const cells = occupancy(board);
  if (cells === null) return [];
  const out: Slide[] = [];
  for (let block = 0; block < board.blocks.length; block++) {
    const position = board.positions[block]!;
    const range = slideRange(board, block, cells);
    for (let to = position - 1; to >= range.min; to--) out.push({ block, to });
    for (let to = position + 1; to <= range.max; to++) out.push({ block, to });
  }
  return out;
}

/** Two boards with the same blocks in the same places. */
export function samePositions(a: Board['positions'], b: Board['positions']): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
