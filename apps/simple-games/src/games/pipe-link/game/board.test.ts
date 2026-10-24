import { describe, expect, it } from 'vitest';
import {
  connectionCount,
  countLit,
  createBoard,
  isAllLit,
  isSolved,
  isValidBoard,
  isValidOrientations,
  litSet,
  neighborOf,
  openEnds,
  totalPipes,
} from './board';
import type { TileType } from './tiles';

const T: Record<string, TileType> = { e: 'end', s: 'straight', l: 'elbow', t: 'tee' };
const boardOf = (w: number, h: number, letters: string, source = 0) =>
  createBoard(
    w,
    h,
    [...letters].map((c) => T[c]!),
    source,
  );

describe('board model', () => {
  it('rejects shapes it cannot hold', () => {
    expect(() => boardOf(1, 1, 'e')).toThrow(RangeError);
    expect(() => boardOf(2, 2, 'eee')).toThrow(RangeError);
    expect(() => boardOf(2, 1, 'ee', 2)).toThrow(RangeError);
    expect(() => boardOf(2, 1, 'ee', -1)).toThrow(RangeError);
    expect(isValidBoard({ width: 2.5, height: 1, types: ['end', 'end'], source: 0 })).toBe(false);
  });

  it('does not wrap at the edges (§1)', () => {
    const board = boardOf(3, 2, 'eeeeee');
    expect(neighborOf(board, 0, 0)).toBe(-1);
    expect(neighborOf(board, 0, 3)).toBe(-1);
    expect(neighborOf(board, 2, 1)).toBe(-1);
    expect(neighborOf(board, 5, 2)).toBe(-1);
    expect(neighborOf(board, 4, 0)).toBe(1);
    expect(neighborOf(board, 4, 1)).toBe(5);
    expect(neighborOf(board, 4, 3)).toBe(3);
  });

  it('checks orientations against each type’s period', () => {
    const board = boardOf(2, 1, 'se');
    expect(isValidOrientations(board, [1, 3])).toBe(true);
    expect(isValidOrientations(board, [2, 3])).toBe(false);
    expect(isValidOrientations(board, [1])).toBe(false);
  });
});

describe('lighting (§2)', () => {
  // 3×1: end → straight → end, source at the left end.
  const row = boardOf(3, 1, 'ese');

  it('lights everything reached from the source through mutual pipes', () => {
    // end right (1), straight across (1), end left (3).
    expect(litSet(row, [1, 1, 3])).toEqual([true, true, true]);
    expect(isAllLit(row, [1, 1, 3])).toBe(true);
    expect(isSolved(row, [1, 1, 3])).toBe(true);
  });

  it('a pipe pointed one way only does not connect', () => {
    // The straight stands upright: the source's pipe meets a closed side.
    expect(litSet(row, [1, 0, 3])).toEqual([true, false, false]);
    expect(countLit(row, [1, 0, 3])).toBe(1);
    // The far end turned away: the straight is lit, the end is not.
    expect(litSet(row, [1, 1, 0])).toEqual([true, true, false]);
  });

  it('the source is lit even when nothing joins it', () => {
    expect(litSet(row, [0, 0, 0])).toEqual([true, false, false]);
  });

  it('lighting follows the source, not cell 0', () => {
    const fromMiddle = boardOf(3, 1, 'ese', 1);
    expect(litSet(fromMiddle, [0, 1, 3])).toEqual([false, true, true]);
  });

  it('counts open ends: into the edge and into a neighbour that does not point back', () => {
    // All three point up: three mouths into the edge, and the straight's down mouth too.
    expect(openEnds(row, [0, 0, 0])).toBe(4);
    expect(openEnds(row, [1, 1, 3])).toBe(0);
    // Source points right, straight is upright: the source's mouth and the straight's two.
    expect(openEnds(row, [1, 0, 3])).toBe(4);
  });
});

describe('the win predicate (§2)', () => {
  it('a loop with every cell lit is not solved (hand-made board, 8 mouths on 4 cells)', () => {
    // 2×2 of elbows turned into a ring.
    const ring = boardOf(2, 2, 'llll');
    const orientations = [1, 2, 0, 3];
    expect(isAllLit(ring, orientations)).toBe(true);
    expect(openEnds(ring, orientations)).toBe(0);
    expect(connectionCount(ring, orientations)).toBe(4);
    expect(isSolved(ring, orientations)).toBe(false);
  });

  it('all lit with a stray open end is not solved (hand-made board, too many mouths)', () => {
    // end → tee → end with the tee's third pipe pointing at the edge.
    const board = boardOf(3, 1, 'ete');
    // tee orientation 1 = right, down, left.
    expect(isAllLit(board, [1, 1, 3])).toBe(true);
    expect(openEnds(board, [1, 1, 3])).toBe(1);
    expect(isSolved(board, [1, 1, 3])).toBe(false);
  });

  it('counts every mouth on the board', () => {
    expect(totalPipes(boardOf(3, 1, 'ese'), [0, 0, 0])).toBe(4);
    expect(totalPipes(boardOf(2, 2, 'llll'), [0, 0, 0, 0])).toBe(8);
  });
});
