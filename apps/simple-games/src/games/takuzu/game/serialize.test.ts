/**
 * Persistence encoding of docs/TAKUZU_RULES.md §11: exact round-trips, and
 * everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * puzzle with no answer, or with a digit written where a given should be, is
 * worse than no save at all: the player is handed a board they cannot finish
 * and nothing to tell them why. Every row below is a record play could not
 * have written, and every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import { decodeBoards, decodeGivens, decodeMarks, decodeSolution, encodeBoard } from './serialize';
import { createLevelSession, doTap } from './session';
import { EMPTY, ONE, ZERO, type Cell, type Mark } from './types';

/** A finished 6×6: every line half and half, no triple, no line twice. */
const SOLUTION = '001011' + '110100' + '011001' + '100110' + '010101' + '101010';

describe('serialize (§11)', () => {
  const solution = decodeSolution(SOLUTION, 6) as Cell[];
  const noGivens = new Array<Mark>(36).fill(EMPTY);

  it('round-trips a whole saved game', () => {
    let session = createLevelSession(3);
    const free = session.givens.findIndex((given) => given === EMPTY);
    session = doTap(session, free)!;

    const encoded = {
      solution: encodeBoard(session.solution),
      givens: encodeBoard(session.givens),
      marks: encodeBoard(session.marks),
    };
    expect(encoded.solution).toHaveLength(36);
    expect(encoded.marks).toContain('.');

    const decoded = decodeBoards(encoded, session.size);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.givens).toEqual([...session.givens]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });

  it('writes one character per cell, with a dot for an empty one', () => {
    expect(encodeBoard([ZERO, ONE, EMPTY, ONE])).toBe('01.1');
  });

  it('accepts a solution and the givens sitting under it', () => {
    expect(solution).not.toBeNull();
    const givens = decodeGivens('0.1.1.' + '.'.repeat(30), 6, solution);
    expect(givens?.[0]).toBe(ZERO);
    expect(givens?.[1]).toBe(EMPTY);
    expect(givens?.[2]).toBe(ONE);
  });

  const malformed: Array<[string, () => unknown]> = [
    ['a solution too short', () => decodeSolution('01', 6)],
    ['a solution too long', () => decodeSolution(SOLUTION + '0', 6)],
    ['a solution read at the wrong size', () => decodeSolution(SOLUTION, 8)],
    ['a stray character', () => decodeSolution('2' + SOLUTION.slice(1), 6)],
    ['a solution with a cell left empty', () => decodeSolution('.' + SOLUTION.slice(1), 6)],
    // Half and half everywhere and still unplayable — the shape of save that
    // would leave someone stuck on a puzzle with no ending.
    ['a solution with three in a row', () => decodeSolution('000111'.repeat(6), 6)],
    [
      'a solution with a row used twice',
      () => decodeSolution(SOLUTION.slice(0, 24) + SOLUTION.slice(0, 6) + SOLUTION.slice(30), 6),
    ],
    ['not a string at all', () => decodeSolution(null, 6)],
    ['an array pretending to be a board', () => decodeSolution([0, 1], 6)],
    [
      'a given that contradicts the solution',
      () => decodeGivens('1' + '.'.repeat(35), 6, solution),
    ],
    ['givens of the wrong length', () => decodeGivens('.'.repeat(35), 6, solution)],
    [
      'a mark written on top of a given',
      () => decodeMarks('1' + '.'.repeat(35), 6, [ONE, ...new Array<Mark>(35).fill(EMPTY)]),
    ],
    ['marks with a stray character', () => decodeMarks('x' + '.'.repeat(35), 6, noGivens)],
    [
      'a record whose givens do not fit its solution',
      () =>
        decodeBoards(
          { solution: SOLUTION, givens: '1' + '.'.repeat(35), marks: '.'.repeat(36) },
          6,
        ),
    ],
    [
      'a record whose marks sit on its givens',
      () =>
        decodeBoards(
          {
            solution: SOLUTION,
            givens: SOLUTION.slice(0, 1) + '.'.repeat(35),
            marks: '0' + '.'.repeat(35),
          },
          6,
        ),
    ],
    [
      'a record missing a part',
      () => decodeBoards({ solution: SOLUTION, givens: '.'.repeat(36), marks: undefined }, 6),
    ],
  ];

  for (const [name, decode] of malformed) {
    it(`refuses ${name}`, () => {
      expect(decode()).toBeNull();
    });
  }
});
