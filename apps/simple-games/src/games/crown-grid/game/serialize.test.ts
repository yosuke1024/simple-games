/**
 * Persistence encoding of docs/CROWN_GRID_RULES.md §11: exact round-trips,
 * and everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * puzzle with no answer, or with a region in two pieces, is worse than no save
 * at all: the player is handed a board they cannot finish and nothing to tell
 * them why. Every row below is a record play could not have written, and
 * every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeBoards,
  decodeMarks,
  decodeRegions,
  decodeSolution,
  encodeMarks,
  encodeRegions,
  encodeSolution,
} from './serialize';
import { createDifficultySession, doMarkCross, doTap } from './session';
import { CROSS, CROWN, EMPTY } from './types';

/** A 6×6 with six connected regions (the easy golden board), and its one answer. */
const REGIONS = 'ddacff' + 'bdacff' + 'dddccf' + 'ddffff' + 'ddfffe' + 'ddffff';

describe('serialize (§11)', () => {
  it('round-trips a whole saved game', () => {
    let session = createDifficultySession('easy', 'crown-grid-easy-serialize');
    session = doTap(session, 0)!;
    session = doTap(doTap(session, 7)!, 7)!;
    session = doMarkCross(session, [1, 2, 3])!;

    const encoded = {
      regions: encodeRegions(session.regions),
      solution: encodeSolution(session.solution),
      marks: encodeMarks(session.marks),
    };
    expect(encoded.regions).toHaveLength(36);
    expect(encoded.solution).toHaveLength(6);
    expect(encoded.marks.startsWith('xxxx...q')).toBe(true);

    const decoded = decodeBoards(encoded, session.size);
    expect(decoded?.regions).toEqual([...session.regions]);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });

  it('writes one character per cell and one digit per row', () => {
    expect(encodeMarks([EMPTY, CROSS, CROWN, EMPTY])).toBe('.xq.');
    expect(encodeRegions([0, 1, 8, 2])).toBe('abic');
    expect(encodeSolution([7, 2, 5, 8, 0, 3, 6, 1, 4])).toBe('725803614');
  });

  it('accepts a legal partition and a legal answer under it', () => {
    const regions = decodeRegions(REGIONS, 6);
    expect(regions).not.toBeNull();
    // The one answer under REGIONS.
    const solution = decodeSolution('204153', regions!, 6);
    expect(solution).toEqual([2, 0, 4, 1, 5, 3]);
  });

  const regions6 = decodeRegions(REGIONS, 6)!;

  const malformed: Array<[string, () => unknown]> = [
    ['regions too short', () => decodeRegions(REGIONS.slice(1), 6)],
    ['regions too long', () => decodeRegions(REGIONS + 'a', 6)],
    ['regions read at the wrong size', () => decodeRegions(REGIONS, 8)],
    ['a region letter past N', () => decodeRegions('g' + REGIONS.slice(1), 6)],
    ['a stray character among the regions', () => decodeRegions('1' + REGIONS.slice(1), 6)],
    // Region a at (0,0) and again at (5,5): two pieces.
    ['a region in two pieces', () => decodeRegions(REGIONS.slice(0, 35) + 'a', 6)],
    ['a partition missing a region', () => decodeRegions(REGIONS.replaceAll('a', 'b'), 6)],
    ['regions that are not a string', () => decodeRegions(null, 6)],
    ['a solution too short', () => decodeSolution('20415', regions6, 6)],
    ['a solution with a letter in it', () => decodeSolution('2041x3', regions6, 6)],
    ['a solution using a column twice', () => decodeSolution('204150', regions6, 6)],
    ['a solution with two crowns touching', () => decodeSolution('204351', regions6, 6)],
    // One per row and column, no touch — but rows 0 and 3 both land in region f.
    ['a solution with two crowns in one region', () => decodeSolution('402513', regions6, 6)],
    ['a solution that is not a string', () => decodeSolution([2, 0, 4, 1, 5, 3], regions6, 6)],
    ['marks of the wrong length', () => decodeMarks('.'.repeat(35), 6)],
    ['marks with a character play never writes', () => decodeMarks('o' + '.'.repeat(35), 6)],
    ['marks that are not a string', () => decodeMarks(undefined, 6)],
    [
      'a record whose answer does not fit its regions',
      () => decodeBoards({ regions: REGIONS, solution: '402513', marks: '.'.repeat(36) }, 6),
    ],
    [
      'a record missing a part',
      () => decodeBoards({ regions: REGIONS, solution: '204153', marks: undefined }, 6),
    ],
  ];

  for (const [name, decode] of malformed) {
    it(`refuses ${name}`, () => {
      expect(decode()).toBeNull();
    });
  }
});
