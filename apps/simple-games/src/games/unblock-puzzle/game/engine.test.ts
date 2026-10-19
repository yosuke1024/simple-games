/**
 * The board rules of docs/UNBLOCK_PUZZLE_RULES.md §1–§4 on hand-built boards:
 * what a legal board is, how far a block slides, which slides are legal (and
 * which collide, leave the board or cross a lane), what a slide does, and
 * the win.
 *
 * The main board, `a` the target, `b` a vertical pair in column 3, `c` a
 * horizontal triple in row 5:
 *
 *   . . . . . .
 *   . . . . . .
 *   a a . b . .   ← exit on the right of this row
 *   . . . b . .
 *   . . . . . .
 *   c c c . . .
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  isLegalSlide,
  isSolved,
  isValidBoard,
  legalSlides,
  occupancy,
  slide,
  slideRange,
} from './engine';
import {
  EXIT_POSITION,
  MAX_BLOCKS,
  TARGET_BLOCK,
  blockCells,
  cellAt,
  type Block,
  type Board,
} from './types';

const B: Block = { orientation: 'v', length: 2, lane: 3 };
const C: Block = { orientation: 'h', length: 3, lane: 5 };
const BOARD: Board = { blocks: [TARGET_BLOCK, B, C], positions: [0, 2, 0] };

describe('cells and occupancy (§1)', () => {
  it('reads a block’s cells along its lane', () => {
    expect(blockCells(TARGET_BLOCK, 0)).toEqual([12, 13]);
    expect(blockCells(B, 2)).toEqual([15, 21]);
    expect(blockCells(C, 0)).toEqual([30, 31, 32]);
    expect(cellAt(B, 0, 1)).toBe(9);
  });

  it('maps every covered cell to its block and the rest to EMPTY', () => {
    const cells = occupancy(BOARD)!;
    expect(cells[12]).toBe(0);
    expect(cells[13]).toBe(0);
    expect(cells[15]).toBe(1);
    expect(cells[21]).toBe(1);
    expect(cells[32]).toBe(2);
    expect([...cells].filter((cell) => cell === EMPTY)).toHaveLength(36 - 7);
  });

  it('refuses overlap and positions off the board', () => {
    // b moved onto the target's row cell 13? b is in column 3; put a second
    // vertical block on top of it instead.
    const overlap: Board = {
      blocks: [TARGET_BLOCK, B, { orientation: 'v', length: 3, lane: 3 }],
      positions: [0, 2, 0],
    };
    expect(occupancy(overlap)).toBeNull();
    expect(occupancy({ ...BOARD, positions: [0, 5, 0] })).toBeNull();
    expect(occupancy({ ...BOARD, positions: [-1, 2, 0] })).toBeNull();
    expect(occupancy({ ...BOARD, positions: [0.5, 2, 0] })).toBeNull();
    expect(occupancy({ ...BOARD, positions: [0, 2] })).toBeNull();
  });
});

describe('legal boards (§1)', () => {
  it('accepts the main board and a target alone', () => {
    expect(isValidBoard(BOARD)).toBe(true);
    expect(isValidBoard({ blocks: [TARGET_BLOCK], positions: [3] })).toBe(true);
  });

  it('wants the target first, horizontal, two long, on the third row', () => {
    expect(isValidBoard({ blocks: [B, TARGET_BLOCK], positions: [2, 0] })).toBe(false);
    for (const target of [
      { orientation: 'h', length: 3, lane: 2 },
      { orientation: 'h', length: 2, lane: 3 },
      { orientation: 'v', length: 2, lane: 2 },
    ] as const) {
      expect(isValidBoard({ blocks: [target], positions: [0] })).toBe(false);
    }
  });

  it('refuses another horizontal block in the target’s row', () => {
    const right: Board = {
      blocks: [TARGET_BLOCK, { orientation: 'h', length: 2, lane: 2 }],
      positions: [0, 4],
    };
    expect(isValidBoard(right)).toBe(false);
    // A vertical block crossing the row is the whole game.
    expect(isValidBoard(BOARD)).toBe(true);
  });

  it('refuses lengths other than 2 and 3, lanes off the grid, and too many blocks', () => {
    const withBlock = (block: Block, position: number): Board => ({
      blocks: [TARGET_BLOCK, block],
      positions: [0, position],
    });
    expect(isValidBoard(withBlock({ orientation: 'v', length: 4 as 2, lane: 0 }, 0))).toBe(false);
    expect(isValidBoard(withBlock({ orientation: 'v', length: 1 as 2, lane: 0 }, 0))).toBe(false);
    expect(isValidBoard(withBlock({ orientation: 'v', length: 2, lane: 6 }, 0))).toBe(false);
    expect(isValidBoard(withBlock({ orientation: 'd' as 'v', length: 2, lane: 0 }, 0))).toBe(false);
  });

  it('holds at most sixteen blocks (§1)', () => {
    // The board packed full: vertical pairs over rows 0–1 and 4–5 in every
    // column, four more across rows 2–3 right of the target, and one
    // horizontal pair under the target. Eighteen blocks, 36 cells, nothing
    // else wrong with it.
    const blocks: Block[] = [TARGET_BLOCK];
    const positions: number[] = [0];
    const add = (block: Block, position: number): void => {
      blocks.push(block);
      positions.push(position);
    };
    for (let lane = 0; lane < 6; lane++) add({ orientation: 'v', length: 2, lane }, 0);
    for (let lane = 2; lane < 6; lane++) add({ orientation: 'v', length: 2, lane }, 2);
    add({ orientation: 'h', length: 2, lane: 3 }, 0);
    for (let lane = 0; lane < 6; lane++) add({ orientation: 'v', length: 2, lane }, 4);
    expect(blocks).toHaveLength(18);
    expect(occupancy({ blocks, positions })).not.toBeNull();
    expect(isValidBoard({ blocks, positions })).toBe(false);
    // Two fewer is a legal board.
    const sixteen: Board = {
      blocks: blocks.slice(0, MAX_BLOCKS),
      positions: positions.slice(0, MAX_BLOCKS),
    };
    expect(isValidBoard(sixteen)).toBe(true);
    expect(isValidBoard({ blocks: blocks.slice(0, 17), positions: positions.slice(0, 17) })).toBe(
      false,
    );
  });
});

describe('slides (§4)', () => {
  it('reaches as far as the free cells go in each direction', () => {
    expect(slideRange(BOARD, 0)).toEqual({ min: 0, max: 1 });
    expect(slideRange(BOARD, 1)).toEqual({ min: 0, max: 4 });
    expect(slideRange(BOARD, 2)).toEqual({ min: 0, max: 3 });
  });

  it('allows any distance through free cells as one slide', () => {
    expect(isLegalSlide(BOARD, { block: 1, to: 0 })).toBe(true);
    expect(isLegalSlide(BOARD, { block: 1, to: 4 })).toBe(true);
    expect(isLegalSlide(BOARD, { block: 2, to: 3 })).toBe(true);
    expect(slide(BOARD, { block: 1, to: 4 })?.positions).toEqual([0, 4, 0]);
  });

  it('refuses a slide through another block, off the board, or to where it is', () => {
    // The target through b.
    expect(isLegalSlide(BOARD, { block: 0, to: 4 })).toBe(false);
    expect(isLegalSlide(BOARD, { block: 0, to: 2 })).toBe(false);
    // Off the board either way.
    expect(isLegalSlide(BOARD, { block: 1, to: 5 })).toBe(false);
    expect(isLegalSlide(BOARD, { block: 0, to: -1 })).toBe(false);
    expect(isLegalSlide(BOARD, { block: 2, to: 4 })).toBe(false);
    // Nowhere.
    expect(isLegalSlide(BOARD, { block: 1, to: 2 })).toBe(false);
    // Not a block, not an offset.
    expect(isLegalSlide(BOARD, { block: 3, to: 0 })).toBe(false);
    expect(isLegalSlide(BOARD, { block: 1, to: 1.5 })).toBe(false);
    expect(slide(BOARD, { block: 0, to: 4 })).toBeNull();
  });

  it('moves only along the block’s lane: offsets are the only thing that changes', () => {
    const next = slide(BOARD, { block: 2, to: 2 })!;
    expect(next.blocks).toBe(BOARD.blocks);
    expect(blockCells(C, next.positions[2]!)).toEqual([32, 33, 34]);
    expect(BOARD.positions).toEqual([0, 2, 0]);
  });

  it('a block wedged between two others cannot move at all', () => {
    const wedged: Board = {
      blocks: [
        TARGET_BLOCK,
        B,
        { orientation: 'v', length: 2, lane: 3 },
        { orientation: 'v', length: 2, lane: 3 },
      ],
      positions: [0, 2, 0, 4],
    };
    expect(isValidBoard(wedged)).toBe(true);
    expect(slideRange(wedged, 1)).toEqual({ min: 2, max: 2 });
    expect(legalSlides(wedged).filter((move) => move.block === 1)).toEqual([]);
  });

  it('lists every legal slide, block by block, nearest first, back before forward', () => {
    expect(legalSlides(BOARD)).toEqual([
      { block: 0, to: 1 },
      { block: 1, to: 1 },
      { block: 1, to: 0 },
      { block: 1, to: 3 },
      { block: 1, to: 4 },
      { block: 2, to: 1 },
      { block: 2, to: 2 },
      { block: 2, to: 3 },
    ]);
    for (const move of legalSlides(BOARD)) expect(isLegalSlide(BOARD, move)).toBe(true);
  });
});

describe('the win (§3)', () => {
  it('is the target against the exit, and only that', () => {
    expect(isSolved(BOARD)).toBe(false);
    const open = slide(BOARD, { block: 1, to: 0 })!;
    expect(isSolved(open)).toBe(false);
    const out = slide(open, { block: 0, to: EXIT_POSITION })!;
    expect(isSolved(out)).toBe(true);
    expect(isSolved({ ...out, positions: [3, 0, 0] })).toBe(false);
  });
});
