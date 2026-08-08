/**
 * Persistence encoding of docs/KAKURO_RULES.md §11: exact round-trips, and
 * everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * puzzle with no answer, or with a layout that is not a Kakuro board, is worse
 * than no save at all: the player is handed something they cannot finish and
 * nothing to tell them why. Every row below is a record play could not have
 * written, and every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeEntries,
  decodeGame,
  decodeLayout,
  decodeNotes,
  decodeSolution,
  encodeGrid,
  encodeLayout,
  encodeNotes,
} from './serialize';
import { buildRuns } from './engine';
import { createLevelSession, doPlace, doToggleNote } from './session';
import { EMPTY, isSize, isValidGrid, isValidLayout, isValidNotes, type Digit } from './types';

/**
 * A 6×6 board, small enough to add up by hand. The top row and the left column
 * are clue cells, the nine white cells form one region, and every run is two
 * to four cells long:
 *
 *     # # # # # #      rows: [7,8]=3  [13,14,15]=12  [20,21]=13  [26,27]=17
 *     # 1 2 # # #      cols: [7,13]=4  [8,14,20,26]=20  [15,21,27]=21
 *     # 3 4 5 # #
 *     # # 6 7 # #
 *     # # 8 9 # #
 *     # # # # # #
 */
const LAYOUT_TEXT = '######' + '#..###' + '#...##' + '##..##' + '##..##' + '######';
const SOLUTION_TEXT = '......' + '.12...' + '.345..' + '..67..' + '..89..' + '......';
const NO_ENTRIES = '.'.repeat(36);
const NO_NOTES = new Array<number>(36).fill(0).join(',');

const gridOf = (text: string): number[] =>
  [...text].map((character) => (character === '.' ? EMPTY : Number(character)));

describe('serialize (§11)', () => {
  it('round-trips a whole saved game', () => {
    let session = createLevelSession(4);
    const free = session.table.white[0]!;
    session = doPlace(session, free, session.solution[free] as Digit)!;
    session = doToggleNote(session, session.table.white[1]!, 2)!;

    const encoded = {
      layout: encodeLayout(session.layout),
      solution: encodeGrid([...session.solution]),
      entries: encodeGrid([...session.board.entries]),
      notes: encodeNotes([...session.board.notes]),
    };
    expect(encoded.layout).toHaveLength(36);
    expect(encoded.solution).toContain('.');
    expect(encoded.entries).toContain('.');

    const decoded = decodeGame(encoded, session.size);
    expect(decoded?.layout).toEqual(session.layout);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.board).toEqual(session.board);
    // The clues come back by addition, never out of the record (§11).
    expect(decoded?.table.runs).toEqual([...session.table.runs]);
  });

  it('writes one character per cell, with # for a clue cell', () => {
    expect(encodeLayout(decodeLayout(LAYOUT_TEXT, 6)!)).toBe(LAYOUT_TEXT);
    expect(encodeGrid([1, 2, EMPTY, 7])).toBe('12.7');
    expect(encodeNotes([0, 3, 511])).toBe('0,3,fv');
  });

  /**
   * The record carries no clue at all, so the same layout and answer must
   * produce the same clues every time it is read back — which is the whole
   * argument for not storing them (§11).
   */
  it('rebuilds the clues from the layout and the answer', () => {
    const decoded = decodeGame(
      { layout: LAYOUT_TEXT, solution: SOLUTION_TEXT, entries: NO_ENTRIES, notes: NO_NOTES },
      6,
    )!;
    expect(decoded.table.runs.map((run) => `${run.axis}:${run.sum}`)).toEqual([
      'row:3',
      'row:12',
      'row:13',
      'row:17',
      'col:4',
      'col:20',
      'col:21',
    ]);
    expect(buildRuns(decoded.layout, decoded.solution)!.runs).toEqual([...decoded.table.runs]);
  });

  const layout = decodeLayout(LAYOUT_TEXT, 6)!;
  const table = buildRuns(layout, gridOf(SOLUTION_TEXT))!;

  const malformed: Array<[string, () => unknown]> = [
    ['a layout too short', () => decodeLayout('##', 6)],
    ['a layout read at the wrong size', () => decodeLayout(LAYOUT_TEXT, 8)],
    ['a layout with a stray character', () => decodeLayout('x' + LAYOUT_TEXT.slice(1), 6)],
    ['a layout that is not a string', () => decodeLayout(null, 6)],

    [
      'a solution with a white cell left blank',
      () => decodeSolution('.'.repeat(36), layout, table),
    ],
    [
      'a solution with a digit on a clue cell',
      () => decodeSolution('1' + SOLUTION_TEXT.slice(1), layout, table),
    ],
    [
      'a zero, which is not a digit here',
      () =>
        decodeSolution(
          '......' + '.02...' + '.345..' + '..67..' + '..89..' + '......',
          layout,
          table,
        ),
    ],
    ['a solution of the wrong length', () => decodeSolution(SOLUTION_TEXT + '1', layout, table)],
    // 3 twice in the run [13,14,15] — §3 rule 1, the one rule a saved answer
    // can break, and the only one this decoder has to check (§11).
    [
      'a solution that repeats a digit inside a run',
      () =>
        decodeSolution(
          '......' + '.12...' + '.334..' + '..67..' + '..89..' + '......',
          layout,
          table,
        ),
    ],
    ['a solution that is not a string', () => decodeSolution(42, layout, table)],

    ['an entry sitting on a clue cell', () => decodeEntries('5' + NO_ENTRIES.slice(1), layout)],
    ['entries with a stray character', () => decodeEntries('x' + NO_ENTRIES.slice(1), layout)],
    ['entries of the wrong length', () => decodeEntries('.'.repeat(35), layout)],

    [
      'notes with the wrong count',
      () => decodeNotes('0,0,0', layout, new Array<number>(36).fill(EMPTY)),
    ],
    ['no notes at all', () => decodeNotes('', layout, new Array<number>(36).fill(EMPTY))],
    [
      'a note holding a bit outside 1..9',
      () =>
        decodeNotes(
          ['zz', ...new Array<number>(35).fill(0)].join(','),
          layout,
          new Array<number>(36).fill(EMPTY),
        ),
    ],
    [
      'a note on a clue cell',
      () =>
        decodeNotes(
          ['6', ...new Array<number>(35).fill(0)].join(','),
          layout,
          new Array<number>(36).fill(EMPTY),
        ),
    ],
    [
      'a note on a cell that already shows a digit',
      () => {
        const entries = new Array<number>(36).fill(EMPTY);
        entries[7] = 1;
        const notes = new Array<number>(36).fill(0);
        notes[7] = 6;
        return decodeNotes(notes.join(','), layout, entries);
      },
    ],
    [
      'notes that are not a string',
      () => decodeNotes(['a'], layout, new Array<number>(36).fill(EMPTY)),
    ],

    /**
     * §1's structural rules, refused through the one function that knows them.
     * A layout with a run of one would hand the player a printed digit; a
     * layout in two islands is two puzzles on one grid.
     */
    [
      'a record whose layout has a run of one',
      () =>
        decodeGame(
          {
            layout: '######' + '#.####' + '#.####' + '######' + '######' + '######',
            solution: '......' + '.1....' + '.2....' + '......' + '......' + '......',
            entries: NO_ENTRIES,
            notes: NO_NOTES,
          },
          6,
        ),
    ],
    [
      'a record whose white cells are in two islands',
      () =>
        decodeGame(
          {
            layout: '######' + '#..###' + '#..###' + '####..' + '####..' + '######',
            solution: '......' + '.12...' + '.34...' + '....56' + '....78' + '......',
            entries: NO_ENTRIES,
            notes: NO_NOTES,
          },
          6,
        ),
    ],
    [
      'a record with a white cell in the left column',
      () =>
        decodeGame(
          {
            layout: '######' + '...###' + '...###' + '######' + '######' + '######',
            solution: '......' + '123...' + '456...' + '......' + '......' + '......',
            entries: NO_ENTRIES,
            notes: NO_NOTES,
          },
          6,
        ),
    ],
    [
      'a record whose answer repeats a digit in a run',
      () =>
        decodeGame(
          {
            layout: LAYOUT_TEXT,
            solution: '......' + '.12...' + '.334..' + '..67..' + '..89..' + '......',
            entries: NO_ENTRIES,
            notes: NO_NOTES,
          },
          6,
        ),
    ],
    [
      'a record whose entries sit on a clue cell',
      () =>
        decodeGame(
          {
            layout: LAYOUT_TEXT,
            solution: SOLUTION_TEXT,
            entries: '5' + NO_ENTRIES.slice(1),
            notes: NO_NOTES,
          },
          6,
        ),
    ],
    [
      'a record missing a part',
      () =>
        decodeGame(
          { layout: LAYOUT_TEXT, solution: SOLUTION_TEXT, entries: NO_ENTRIES, notes: undefined },
          6,
        ),
    ],
    [
      'a record read at a size it was not written at',
      () =>
        decodeGame(
          { layout: LAYOUT_TEXT, solution: SOLUTION_TEXT, entries: NO_ENTRIES, notes: NO_NOTES },
          8,
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
 * the numbers are numbers of the right kind and sit where a kind of cell
 * allows them. Whether they agree with each other is what the decoders answer.
 */
describe('structural validators (§11)', () => {
  const layout = decodeLayout(LAYOUT_TEXT, 6)!;

  it('knows this game’s sizes from another game’s', () => {
    expect([isSize(6), isSize(8), isSize(10)]).toEqual([true, true, true]);
    expect([isSize(4), isSize(7), isSize(12), isSize('6'), isSize(null)]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('accepts a layout of this size and refuses everything else', () => {
    expect(isValidLayout(layout, 6)).toBe(true);
    expect(isValidLayout(layout, 8)).toBe(false);
    expect(isValidLayout({ width: 6, height: 6, cells: [] }, 6)).toBe(false);
    expect(isValidLayout({ width: 6, height: 6, cells: new Array<number>(36).fill(2) }, 6)).toBe(
      false,
    );
    expect(isValidLayout(null, 6)).toBe(false);
    expect(isValidLayout('######', 6)).toBe(false);
  });

  it('accepts a grid whose digits sit only on white cells', () => {
    const empty = new Array<number>(36).fill(EMPTY);
    expect(isValidGrid(empty, layout)).toBe(true);
    const written = [...empty];
    written[7] = 9;
    expect(isValidGrid(written, layout)).toBe(true);
    const onClue = [...empty];
    onClue[0] = 1;
    expect(isValidGrid(onClue, layout)).toBe(false);
    const tooBig = [...empty];
    tooBig[7] = 10;
    expect(isValidGrid(tooBig, layout)).toBe(false);
    expect(isValidGrid([1, 2, 3], layout)).toBe(false);
    expect(isValidGrid('123', layout)).toBe(false);
  });

  it('accepts note masks a white cell could hold', () => {
    const empty = new Array<number>(36).fill(0);
    expect(isValidNotes(empty, layout)).toBe(true);
    const noted = [...empty];
    noted[7] = 511;
    expect(isValidNotes(noted, layout)).toBe(true);
    const tooWide = [...empty];
    tooWide[7] = 512;
    expect(isValidNotes(tooWide, layout)).toBe(false);
    const onClue = [...empty];
    onClue[0] = 1;
    expect(isValidNotes(onClue, layout)).toBe(false);
    expect(isValidNotes(new Array<number>(35).fill(0), layout)).toBe(false);
  });
});
