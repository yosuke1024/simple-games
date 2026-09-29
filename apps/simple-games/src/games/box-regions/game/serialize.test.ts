/**
 * The fail-closed save format of docs/BOX_REGIONS_RULES.md §11: a solution
 * survives only as a full partition into rectangles that keep every clue,
 * and an assignment only as boxes play could have drawn.
 */
import { describe, expect, it } from 'vitest';
import { decodeAssignment, decodeBoards, decodeSolution, encodeRegions } from './serialize';
import type { Layout } from './types';

/** a a b / a a b / c c c — a 2×2 square, a tall pair, a wide row. */
const LAYOUT: Layout = {
  width: 3,
  height: 3,
  clues: [
    { index: 0, size: 4, kind: 'square' },
    { index: 5, size: 2, kind: 'tall' },
    { index: 7, size: 3, kind: 'wide' },
  ],
};

describe('solutions', () => {
  it('reads a legal answer back', () => {
    expect(decodeSolution('aabaabccc', LAYOUT)).toEqual([0, 0, 1, 0, 0, 1, 2, 2, 2]);
    expect(encodeRegions([0, 0, 1, 0, 0, 1, 2, 2, 2])).toBe('aabaabccc');
  });

  it('drops an answer that breaks a rule, or is not full', () => {
    // Not a rectangle.
    expect(decodeSolution('aabaacbcc', LAYOUT)).toBeNull();
    // The same cells against a clue that asks for a wide pair: the kind breaks.
    expect(
      decodeSolution('aabaabccc', {
        ...LAYOUT,
        clues: [LAYOUT.clues[0]!, { index: 5, size: 2, kind: 'wide' }, LAYOUT.clues[2]!],
      }),
    ).toBeNull();
    expect(decodeSolution('aabaab.cc', LAYOUT)).toBeNull();
    // A region letter past the clues, and one that is not a letter at all.
    expect(decodeSolution('aabaabccd', LAYOUT)).toBeNull();
    expect(decodeSolution('aabaabcc1', LAYOUT)).toBeNull();
    expect(decodeSolution('aabaabcc', LAYOUT)).toBeNull();
    expect(decodeSolution(42, LAYOUT)).toBeNull();
  });
});

describe('assignments', () => {
  it('reads boxes that play could have drawn, undrawn clues included', () => {
    expect(decodeAssignment('.........', LAYOUT)).toEqual(new Array(9).fill(-1));
    // A wrong but legal box: a as a 1×2 — play draws those.
    expect(decodeAssignment('aa.......', LAYOUT)).toEqual([0, 0, -1, -1, -1, -1, -1, -1, -1]);
    // A 1×1 on a clue.
    expect(decodeAssignment('.....b...', LAYOUT)).not.toBeNull();
  });

  it('drops a box that is not a rectangle, misses its clue, or holds another', () => {
    expect(decodeAssignment('aa.a.....', LAYOUT)).toBeNull();
    expect(decodeAssignment('.a.......', LAYOUT)).toBeNull();
    expect(decodeAssignment('aaaaaa...', LAYOUT)).toBeNull();
  });

  it('decodes both boards at once, or neither', () => {
    expect(decodeBoards({ solution: 'aabaabccc', assignment: 'aa.aa....' }, LAYOUT)).toEqual({
      solution: [0, 0, 1, 0, 0, 1, 2, 2, 2],
      assignment: [0, 0, -1, 0, 0, -1, -1, -1, -1],
    });
    expect(decodeBoards({ solution: 'aabaabccc', assignment: 'a.a......' }, LAYOUT)).toBeNull();
    expect(decodeBoards({ solution: 'aaaaaaaaa', assignment: '.........' }, LAYOUT)).toBeNull();
  });
});
