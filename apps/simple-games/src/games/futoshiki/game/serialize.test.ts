/**
 * Persistence encoding of docs/FUTOSHIKI_RULES.md §11: exact round-trips, and
 * everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * puzzle with no answer, or with a sign the answer breaks, is worse than no
 * save at all: the player is handed a board they cannot finish and nothing to
 * tell them why. Every row below is a record play could not have written, and
 * every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeConstraints,
  decodeEntries,
  decodeGame,
  decodeGivens,
  decodeNotes,
  decodeSolution,
  encodeConstraints,
  encodeGrid,
  encodeNotes,
} from './serialize';
import { createLevelSession, doPlace, doToggleNote } from './session';
import {
  EMPTY,
  constraintCells,
  constraintSymbol,
  isConstraint,
  isFilledGrid,
  isSize,
  isValidGrid,
  isValidNotes,
  type Digit,
} from './types';

/** A finished 4×4: every row and every column holds 1..4 once. */
const SOLUTION = '1234' + '2341' + '3412' + '4123';
/** `1 < 2` across the top-left gap, and `1 < 2` down the left edge. */
const SIGNS = '0h<,0v<';
const NO_NOTES = new Array<number>(16).fill(0);

describe('serialize (§11)', () => {
  const solution = decodeSolution(SOLUTION, 4)!;

  it('round-trips a whole saved game', () => {
    let session = createLevelSession(20);
    const free = session.board.givens.findIndex((given) => given === EMPTY);
    session = doPlace(session, free, session.solution[free] as Digit)!;
    session = doToggleNote(session, session.board.givens.lastIndexOf(EMPTY), 2)!;

    const encoded = {
      solution: encodeGrid(session.solution),
      constraints: encodeConstraints(session.constraints, session.size),
      givens: encodeGrid(session.board.givens),
      entries: encodeGrid(session.board.entries),
      notes: encodeNotes(session.board.notes),
    };
    expect(encoded.solution).toHaveLength(25);
    expect(encoded.entries).toContain('.');

    const decoded = decodeGame(encoded, session.size);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.constraints).toEqual([...session.constraints]);
    expect(decoded?.board).toEqual(session.board);
  });

  it('writes one character per cell, with a dot for an empty one', () => {
    expect(encodeGrid([1, 2, EMPTY, 7])).toBe('12.7');
  });

  it('writes a sign as its upper-left cell, its gap and its direction', () => {
    expect(encodeConstraints([{ less: 0, greater: 1 }], 4)).toBe('0h<');
    expect(encodeConstraints([{ less: 1, greater: 0 }], 4)).toBe('0h>');
    expect(encodeConstraints([{ less: 0, greater: 4 }], 4)).toBe('0v<');
    expect(encodeConstraints([{ less: 4, greater: 0 }], 4)).toBe('0v>');
    expect(decodeConstraints('0h<,0v<', 4, solution)).toEqual([
      { less: 0, greater: 1 },
      { less: 0, greater: 4 },
    ]);
  });

  it('accepts givens, entries and notes that fit each other', () => {
    expect(decodeGivens('1.3.' + '.'.repeat(12), 4, solution)?.[0]).toBe(1);
    expect(
      decodeEntries('.2..' + '.'.repeat(12), 4, [1, ...new Array<number>(15).fill(EMPTY)]),
    ).not.toBeNull();
    expect(
      decodeNotes(['6', ...NO_NOTES.slice(1)].join(','), 4, new Array<number>(16).fill(EMPTY)),
    ).toEqual([6, ...NO_NOTES.slice(1)]);
  });

  const malformed: Array<[string, () => unknown]> = [
    ['a solution too short', () => decodeSolution('12', 4)],
    ['a solution too long', () => decodeSolution(SOLUTION + '1', 4)],
    ['a solution read at the wrong size', () => decodeSolution(SOLUTION, 5)],
    ['a stray character', () => decodeSolution('x' + SOLUTION.slice(1), 4)],
    ['a digit this size has not got', () => decodeSolution('5' + SOLUTION.slice(1), 4)],
    ['a zero, which is not a digit here', () => decodeSolution('0' + SOLUTION.slice(1), 4)],
    ['a solution with a cell left empty', () => decodeSolution('.' + SOLUTION.slice(1), 4)],
    // Every row is 1..4 and every column is not — the shape of save that would
    // leave someone stuck on a puzzle with no ending.
    ['a solution that is not a Latin square', () => decodeSolution('1234'.repeat(4), 4)],
    ['not a string at all', () => decodeSolution(null, 4)],
    ['an array pretending to be a grid', () => decodeSolution([1, 2], 4)],

    ['a board with no signs, which is not this game', () => decodeConstraints('', 4, solution)],
    ['a sign that is not a token', () => decodeConstraints('0h', 4, solution)],
    ['a sign with a made-up gap letter', () => decodeConstraints('0x<', 4, solution)],
    ['a sign off the right edge', () => decodeConstraints('3h<', 4, solution)],
    ['a sign off the bottom edge', () => decodeConstraints('12v<', 4, solution)],
    ['a sign off the board', () => decodeConstraints('16h<', 4, solution)],
    ['the same gap twice', () => decodeConstraints('0h<,0h<', 4, solution)],
    ['a sign the answer breaks', () => decodeConstraints('0h>', 4, solution)],
    ['signs that are not a string', () => decodeConstraints(42, 4, solution)],

    [
      'a given that contradicts the solution',
      () => decodeGivens('2' + '.'.repeat(15), 4, solution),
    ],
    ['givens of the wrong length', () => decodeGivens('.'.repeat(15), 4, solution)],
    [
      'an entry written on top of a given',
      () => decodeEntries('2' + '.'.repeat(15), 4, [1, ...new Array<number>(15).fill(EMPTY)]),
    ],
    ['entries with a stray character', () => decodeEntries('x' + '.'.repeat(15), 4, solution)],

    ['notes with the wrong count', () => decodeNotes('0,0,0', 4, solution)],
    ['no notes at all', () => decodeNotes('', 4, solution)],
    [
      'a note holding a digit this size has not got',
      () =>
        decodeNotes(['16', ...NO_NOTES.slice(1)].join(','), 4, new Array<number>(16).fill(EMPTY)),
    ],
    [
      'a note that is not a number',
      () =>
        decodeNotes(['zz', ...NO_NOTES.slice(1)].join(','), 4, new Array<number>(16).fill(EMPTY)),
    ],
    [
      'a note on a cell that already shows a digit',
      () => decodeNotes(['6', ...NO_NOTES.slice(1)].join(','), 4, solution),
    ],

    [
      'a record whose givens do not fit its solution',
      () =>
        decodeGame(
          {
            solution: SOLUTION,
            constraints: SIGNS,
            givens: '2' + '.'.repeat(15),
            entries: '.'.repeat(16),
            notes: NO_NOTES.join(','),
          },
          4,
        ),
    ],
    [
      'a record whose entries sit on its givens',
      () =>
        decodeGame(
          {
            solution: SOLUTION,
            constraints: SIGNS,
            givens: '1' + '.'.repeat(15),
            entries: '1' + '.'.repeat(15),
            notes: NO_NOTES.join(','),
          },
          4,
        ),
    ],
    [
      'a record whose signs disagree with its solution',
      () =>
        decodeGame(
          {
            solution: SOLUTION,
            constraints: '0h>',
            givens: '.'.repeat(16),
            entries: '.'.repeat(16),
            notes: NO_NOTES.join(','),
          },
          4,
        ),
    ],
    [
      'a record missing a part',
      () =>
        decodeGame(
          {
            solution: SOLUTION,
            constraints: SIGNS,
            givens: '.'.repeat(16),
            entries: '.'.repeat(16),
            notes: undefined,
          },
          4,
        ),
    ],
  ];

  for (const [name, decode] of malformed) {
    it(`refuses ${name}`, () => {
      expect(decode()).toBeNull();
    });
  }
});

/**
 * The structural half of §11's fail-closed check — the part the storage layer
 * runs before any of this file's decoders see a record. Shape only: whether
 * the numbers are numbers of the right kind and the signs join cells that
 * touch. Whether they agree with each other is what the decoders above answer.
 */
describe('structural validators (§11)', () => {
  it('knows this game’s sizes from another game’s', () => {
    expect([isSize(4), isSize(7)]).toEqual([true, true]);
    expect([isSize(3), isSize(8), isSize('4'), isSize(null)]).toEqual([false, false, false, false]);
  });

  it('accepts a grid of this size and refuses everything else', () => {
    expect(isValidGrid(new Array<number>(16).fill(EMPTY), 4)).toBe(true);
    expect(isValidGrid([1, 2, 3, 4], 4)).toBe(false);
    expect(isValidGrid([5, ...new Array<number>(15).fill(EMPTY)], 4)).toBe(false);
    expect(isValidGrid([-1, ...new Array<number>(15).fill(EMPTY)], 4)).toBe(false);
    expect(isValidGrid([1.5, ...new Array<number>(15).fill(EMPTY)], 4)).toBe(false);
    expect(isValidGrid('1234', 4)).toBe(false);
    expect(isFilledGrid(new Array<number>(16).fill(1), 4)).toBe(true);
    expect(isFilledGrid(new Array<number>(16).fill(EMPTY), 4)).toBe(false);
  });

  it('accepts note masks this size could hold', () => {
    expect(isValidNotes(new Array<number>(16).fill(15), 4)).toBe(true);
    expect(isValidNotes(new Array<number>(16).fill(16), 4)).toBe(false);
    expect(isValidNotes(new Array<number>(15).fill(0), 4)).toBe(false);
  });

  it('accepts a sign between two cells that touch, and nothing else', () => {
    expect(isConstraint({ less: 0, greater: 1 }, 4)).toBe(true);
    expect(isConstraint({ less: 4, greater: 0 }, 4)).toBe(true);
    // Cells 3 and 4 are one apart in the array and on opposite edges of the board.
    expect(isConstraint({ less: 3, greater: 4 }, 4)).toBe(false);
    expect(isConstraint({ less: 0, greater: 5 }, 4)).toBe(false);
    expect(isConstraint({ less: 0, greater: 16 }, 4)).toBe(false);
    expect(isConstraint({ less: 0, greater: 1 }, 5)).toBe(true);
    expect(isConstraint(null, 4)).toBe(false);
    expect(isConstraint({ less: '0', greater: 1 }, 4)).toBe(false);
  });

  it('reads a sign the way the board draws it: pointed end towards the smaller', () => {
    expect(constraintCells({ less: 5, greater: 4 })).toEqual([4, 5]);
    expect(constraintSymbol({ less: 4, greater: 5 })).toBe('<');
    expect(constraintSymbol({ less: 5, greater: 4 })).toBe('>');
  });
});
