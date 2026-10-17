/**
 * Core Unblock Puzzle types. See docs/UNBLOCK_PUZZLE_RULES.md — the single
 * source of truth for the rules these shapes serve.
 *
 * A block never leaves its lane: a horizontal block keeps its row and a
 * vertical one its column (§2). So a block is described once — orientation,
 * length, lane — and everything that changes during play is one number per
 * block, its offset along the lane. A board is the block list plus that
 * position list, and every rule is read from those two arrays alone.
 */

/** Cells per side (§1). */
export const BOARD_SIZE = 6;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

/** The target is block 0, horizontal, two cells long, on the third row (§1). */
export const TARGET_INDEX = 0;
export const TARGET_ROW = 2;
export const TARGET_LENGTH = 2;

/**
 * The exit is on the right edge of the target's row; the board is solved the
 * moment the target's left cell reaches this column — its right cell is then
 * against the exit (§3).
 */
export const EXIT_POSITION = BOARD_SIZE - TARGET_LENGTH;

/**
 * The most blocks a board may hold, the target included (§1). Sixteen keeps a
 * board to one lowercase letter per block in a save (§12) and a search state
 * to 3 bits per block in two 32-bit words (search.ts).
 */
export const MAX_BLOCKS = 16;

export type Orientation = 'h' | 'v';
export type BlockLength = 2 | 3;

export interface Block {
  /** `h` slides left and right along a row, `v` up and down along a column. */
  readonly orientation: Orientation;
  readonly length: BlockLength;
  /** The row of a horizontal block, the column of a vertical one. */
  readonly lane: number;
}

/**
 * A block's offset along its lane: the column of a horizontal block's left
 * cell, the row of a vertical block's top cell. Indexed like `blocks`.
 */
export type Positions = readonly number[];

/** Everything a rule is read against: the blocks and where each one is. */
export interface Board {
  readonly blocks: readonly Block[];
  readonly positions: Positions;
}

/** One move: a block and the offset it ends on (§4). */
export interface Slide {
  readonly block: number;
  readonly to: number;
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  DIFFICULTIES.includes(value as Difficulty);

/** Free Play draws a new board whenever asked; the daily is today's one board (§9). */
export type GameMode = 'free' | 'daily';

/** There is no losing: no move limit worth meeting, no dead end (§3). */
export type GameStatus = 'playing' | 'solved';

/** The highest offset a block of this length can take along a lane. */
export const maxOffset = (length: number): number => BOARD_SIZE - length;

/** The cell index of a block's cell `k` (0 = left / top) at an offset. */
export function cellAt(block: Block, position: number, k: number): number {
  return block.orientation === 'h'
    ? block.lane * BOARD_SIZE + position + k
    : (position + k) * BOARD_SIZE + block.lane;
}

/** Every cell a block covers at an offset, left to right or top to bottom. */
export function blockCells(block: Block, position: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < block.length; k++) out.push(cellAt(block, position, k));
  return out;
}

export const rowOf = (cell: number): number => Math.floor(cell / BOARD_SIZE);
export const colOf = (cell: number): number => cell % BOARD_SIZE;

/** The target's shape — the one block every board has, always first (§1). */
export const TARGET_BLOCK: Block = { orientation: 'h', length: TARGET_LENGTH, lane: TARGET_ROW };

export const isTargetShape = (block: Block): boolean =>
  block.orientation === 'h' && block.length === TARGET_LENGTH && block.lane === TARGET_ROW;
