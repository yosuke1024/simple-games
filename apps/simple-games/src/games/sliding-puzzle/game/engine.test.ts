/**
 * The play rules of docs/SLIDING_PUZZLE_RULES.md §2 and §3: what a tap does,
 * what it costs, what it must refuse, and when the board is finished.
 *
 * Boards are written out by hand so each case says which position it is about.
 * The 3x3 boards below are all reachable positions — a fixture that could never
 * occur in play would prove nothing about play.
 */
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  blankIndex,
  inversionCount,
  isSolvable,
  isSolved,
  isValidTiles,
  neighborsOfBlank,
  tilesToMove,
} from './engine';
import { solvedTiles, type Tiles } from './types';

/**
 *  1 2 3
 *  4 5 6
 *  7 _ 8      — one tap from finished, in two different ways.
 */
const NEARLY: Tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8];

/**
 *  1 2 3
 *  4 5 6
 *  _ 7 8      — the blank at the start of the bottom row.
 */
const ROW_START: Tiles = [1, 2, 3, 4, 5, 6, 0, 7, 8];

describe('reading the board', () => {
  it('finds the blank and recognises the finished board (§2)', () => {
    expect(blankIndex(NEARLY)).toBe(7);
    expect(isSolved(solvedTiles(3), 3)).toBe(true);
    expect(isSolved(solvedTiles(4), 4)).toBe(true);
    expect(isSolved(solvedTiles(5), 5)).toBe(true);
    expect(isSolved(NEARLY, 3)).toBe(false);
    // The blank has to be last, not merely present.
    expect(isSolved([0, 1, 2, 3, 4, 5, 6, 7, 8], 3)).toBe(false);
  });

  it('rejects anything that is not a permutation of 0..N²-1', () => {
    expect(isValidTiles(solvedTiles(3), 3)).toBe(true);
    expect(isValidTiles([1, 2, 3], 3)).toBe(false);
    expect(isValidTiles([1, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
    expect(isValidTiles([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toBe(false);
  });

  it('lists the tiles that can slide on their own', () => {
    // Blank at the bottom edge: the tile above it and the two beside it.
    expect([...neighborsOfBlank(NEARLY, 3)].sort((a, b) => a - b)).toEqual([4, 6, 8]);
    // Blank in the middle of a 3x3: four neighbours.
    const centre: Tiles = [1, 2, 3, 4, 0, 6, 7, 5, 8];
    expect([...neighborsOfBlank(centre, 3)].sort((a, b) => a - b)).toEqual([1, 3, 5, 7]);
  });
});

describe('a single-tile slide (§3)', () => {
  it('moves the tapped tile into the blank and costs one move', () => {
    const result = applyMove(NEARLY, 3, 8)!;
    expect(result.tiles).toEqual(solvedTiles(3));
    expect(result.moved).toBe(1);
    expect(isSolved(result.tiles, 3)).toBe(true);
  });

  it('works in a column as well as a row', () => {
    // The 5 sits directly above the blank.
    const result = applyMove(NEARLY, 3, 4)!;
    expect(result.tiles).toEqual([1, 2, 3, 4, 0, 6, 7, 5, 8]);
    expect(result.moved).toBe(1);
  });

  it('leaves the original board untouched', () => {
    const before = [...NEARLY];
    applyMove(NEARLY, 3, 8);
    expect(NEARLY).toEqual(before);
  });
});

describe('a multi-tile slide (§3)', () => {
  it('moves every tile between the tap and the blank, in one go', () => {
    // Blank at the start of the bottom row; tapping the 8 brings 7 and 8 over.
    expect(tilesToMove(ROW_START, 3, 8)).toEqual([7, 8]);
    const result = applyMove(ROW_START, 3, 8)!;
    expect(result.tiles).toEqual(solvedTiles(3));
    expect(result.moved).toBe(2);
  });

  it('does the same down a column', () => {
    // Blank bottom-middle; tapping the 2 brings 2 and 5 down one row each.
    const result = applyMove(NEARLY, 3, 1)!;
    expect(result.tiles).toEqual([1, 0, 3, 4, 2, 6, 7, 5, 8]);
    expect(result.moved).toBe(2);
  });

  it('counts moves by tiles moved, not by taps (§3)', () => {
    // Three tiles across a 4x4 row: one tap, three moves.
    const board: Tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 13, 14, 15];
    expect(tilesToMove(board, 4, 15)).toEqual([13, 14, 15]);
    const result = applyMove(board, 4, 15)!;
    expect(result.moved).toBe(3);
    expect(result.tiles).toEqual(solvedTiles(4));
  });
});

describe('taps that do nothing (§3)', () => {
  it('refuses a tile that shares neither the row nor the column', () => {
    // The 1 is at (0,0); the blank is at (2,1).
    expect(tilesToMove(NEARLY, 3, 0)).toBeNull();
    expect(applyMove(NEARLY, 3, 0)).toBeNull();
  });

  it('refuses the blank itself and anything off the board', () => {
    expect(applyMove(NEARLY, 3, 7)).toBeNull();
    expect(applyMove(NEARLY, 3, -1)).toBeNull();
    expect(applyMove(NEARLY, 3, 9)).toBeNull();
    expect(applyMove(NEARLY, 3, 1.5)).toBeNull();
  });
});

describe('solvability (§5)', () => {
  it('accepts the finished board at every size', () => {
    expect(isSolvable(solvedTiles(3), 3)).toBe(true);
    expect(isSolvable(solvedTiles(4), 4)).toBe(true);
    expect(isSolvable(solvedTiles(5), 5)).toBe(true);
  });

  it('rejects a board one swap away from finished', () => {
    // A single transposition flips the parity, at odd and even N alike. The 4x4
    // case is the classic "15-14 puzzle" that cannot be solved.
    expect(isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3)).toBe(false);
    const swapped = [...solvedTiles(4)];
    swapped[13] = 15;
    swapped[14] = 14;
    expect(isSolvable(swapped, 4)).toBe(false);
  });

  it('is preserved by every legal move', () => {
    let tiles: Tiles = solvedTiles(4);
    for (const index of [11, 10, 6, 7, 3, 2, 1, 5]) {
      const result = applyMove(tiles, 4, index);
      if (!result) continue;
      tiles = result.tiles;
      expect(isSolvable(tiles, 4)).toBe(true);
    }
  });

  it('counts inversions over the tiles only', () => {
    expect(inversionCount(solvedTiles(3))).toBe(0);
    expect(inversionCount([2, 1, 3, 4, 5, 6, 7, 8, 0])).toBe(1);
    // The blank is skipped, so moving it around cannot change the count.
    expect(inversionCount([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(0);
  });
});
