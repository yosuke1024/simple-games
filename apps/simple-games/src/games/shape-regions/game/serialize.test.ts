/**
 * Persistence encoding of docs/SHAPE_REGIONS_RULES.md §11: exact round-trips,
 * and everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * puzzle with no answer, or into a board play could not have produced, is
 * worse than no save at all: the player is handed a region they cannot finish
 * and nothing to tell them why. Every row below is a record play could not
 * have written, and every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import { decodeAssignment, decodeBoards, decodeSolution, encodeRegions } from './serialize';
import { createDifficultySession, doStroke } from './session';
import { UNASSIGNED, type Layout } from './types';

/** Three horizontal lines, clued at the left end of each. */
const LINES: Layout = {
  width: 3,
  height: 3,
  clues: [
    { index: 0, size: 3, shape: 'line' },
    { index: 3, size: 3, shape: 'line' },
    { index: 6, size: 3, shape: 'line' },
  ],
};
const SOLUTION = 'aaabbbccc';

const withCharacter = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

describe('serialize (§11)', () => {
  it('writes one letter per cell, with a dot for an empty one', () => {
    expect(encodeRegions([0, 1, UNASSIGNED, 25])).toBe('ab.z');
  });

  it('round-trips a whole saved game', () => {
    let session = createDifficultySession('easy', 'shape-regions-easy-serialize');
    const clue = session.clues[0]!.index;
    const neighbour = clue % session.width < session.width - 1 ? clue + 1 : clue - 1;
    session = doStroke(session, 0, [neighbour]) ?? session;

    const encoded = {
      solution: encodeRegions(session.solution),
      assignment: encodeRegions(session.assignment),
    };
    expect(encoded.solution).toHaveLength(25);
    expect(encoded.assignment).toContain('.');

    const decoded = decodeBoards(encoded, session);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.assignment).toEqual([...session.assignment]);
  });

  it('accepts the hand-drawn board and a partly grown assignment', () => {
    expect(decodeSolution(SOLUTION, LINES)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(decodeAssignment('aa.b..c..', LINES)).toEqual([0, 0, -1, 1, -1, -1, 2, -1, -1]);
  });

  const malformed: Array<[string, () => unknown]> = [
    ['a solution too short', () => decodeSolution('aaabbbcc', LINES)],
    ['a solution too long', () => decodeSolution(SOLUTION + 'c', LINES)],
    ['a solution with a stray character', () => decodeSolution('aaabbbcc1', LINES)],
    ['a solution naming a region that does not exist', () => decodeSolution('aaabbbccd', LINES)],
    ['a solution with a cell left empty', () => decodeSolution('aaabbbcc.', LINES)],
    ['a solution that breaks a clue', () => decodeSolution('aabbbaccc', LINES)],
    ['a solution with a clue in another region', () => decodeSolution('aaaabbccc', LINES)],
    ['a solution whose region is not connected', () => decodeSolution('aabbbaccc', LINES)],
    ['not a string at all', () => decodeSolution(null, LINES)],
    ['an array pretending to be a board', () => decodeSolution([0, 1], LINES)],
    [
      'a solution against clues that say nothing',
      () =>
        decodeSolution(SOLUTION, {
          ...LINES,
          clues: [{ index: 0, size: null, shape: null }, ...LINES.clues.slice(1)],
        }),
    ],
    [
      'a solution against a clue outside the size bounds',
      () =>
        decodeSolution(SOLUTION, {
          ...LINES,
          clues: [{ index: 0, size: 7, shape: null }, ...LINES.clues.slice(1)],
        }),
    ],
    [
      'a solution against two clues on one cell',
      () =>
        decodeSolution(SOLUTION, {
          ...LINES,
          clues: [LINES.clues[0]!, { index: 0, size: 3, shape: 'line' }, LINES.clues[2]!],
        }),
    ],
    ['an assignment with a clue cell left empty', () => decodeAssignment('.a.b..c..', LINES)],
    [
      'an assignment with a clue cell in another region',
      () => decodeAssignment('bbbb..c..', LINES),
    ],
    ['an assignment holding another region’s clue', () => decodeAssignment('aaaa..c..', LINES)],
    [
      'an assignment with a cell the clue cannot reach',
      () => decodeAssignment(withCharacter('a..b..c..', 2, 'a'), LINES),
    ],
    ['an assignment of the wrong length', () => decodeAssignment('a..b..c.', LINES)],
    ['an assignment with a stray character', () => decodeAssignment('a..b..c.x', LINES)],
    [
      'a record whose assignment does not fit its clues',
      () => decodeBoards({ solution: SOLUTION, assignment: 'a..b..c.a' }, LINES),
    ],
    [
      'a record missing a part',
      () => decodeBoards({ solution: SOLUTION, assignment: undefined }, LINES),
    ],
  ];

  for (const [name, decode] of malformed) {
    it(`refuses ${name}`, () => {
      expect(decode()).toBeNull();
    });
  }
});
