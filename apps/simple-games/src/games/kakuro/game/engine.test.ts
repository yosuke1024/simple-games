/**
 * Board rules of docs/KAKURO_RULES.md §1, §2, §3, §4 and §5: reading the runs
 * out of a layout, writing a digit, the notes that come with it, the
 * always-on violation display, and the win.
 *
 * Layouts are written as rows of characters because that is how a board reads
 * — '#' is a clue cell and '.' a white one, and a row of digits is something
 * you can check by eye.
 */
import { describe, expect, it } from 'vitest';
import {
  buildRuns,
  clueTable,
  createBoard,
  erase,
  findViolations,
  hasNote,
  isComplete,
  isConnectedWhite,
  isSolved,
  mistakenCells,
  peersOf,
  place,
  runGeometry,
  toggleNote,
} from './engine';
import { BLOCK, EMPTY, WHITE, type Digit, type Layout, type RunTable } from './types';

const layoutOf = (...rows: string[]): Layout => ({
  width: rows[0]!.length,
  height: rows.length,
  cells: rows
    .join('')
    .split('')
    .map((character) => (character === '#' ? BLOCK : WHITE)),
});

const gridOf = (...rows: string[]): number[] =>
  rows
    .join('')
    .split('')
    .map((character) => (character === '.' ? EMPTY : Number(character)));

/**
 * A 4×4 board with three row runs and three column runs, small enough that
 * every clue can be added up by hand:
 *
 *     # # # #        row runs: [5,6]=3  [9,10,11]=12  [13,14,15]=21
 *     # 1 2 #        col runs: [5,9,13]=10  [6,10,14]=13  [11,15]=13
 *     # 3 4 5
 *     # 6 7 8
 */
const LAYOUT = layoutOf('####', '#..#', '#...', '#...');
const SOLUTION = gridOf('....', '.12.', '.345', '.678');
const TABLE = buildRuns(LAYOUT, SOLUTION)!;

describe('reading the runs out of a layout (§1)', () => {
  it('finds every run on both axes, in reading order, with its clue cell', () => {
    const geometry = runGeometry(LAYOUT)!;
    expect(geometry.shapes).toEqual([
      { axis: 'row', clue: 4, cells: [5, 6] },
      { axis: 'row', clue: 8, cells: [9, 10, 11] },
      { axis: 'row', clue: 12, cells: [13, 14, 15] },
      { axis: 'col', clue: 1, cells: [5, 9, 13] },
      { axis: 'col', clue: 2, cells: [6, 10, 14] },
      { axis: 'col', clue: 7, cells: [11, 15] },
    ]);
    expect(geometry.white).toEqual([5, 6, 9, 10, 11, 13, 14, 15]);
    // Every white cell in exactly one run of each axis — the invariant the
    // whole solver indexes by (§1).
    for (const index of geometry.white) {
      expect(geometry.rowRun[index]).toBeGreaterThanOrEqual(0);
      expect(geometry.colRun[index]).toBeGreaterThanOrEqual(0);
    }
    expect(geometry.rowRun[0]).toBe(-1);
    expect(geometry.colRun[0]).toBe(-1);
  });

  it('adds the clues up from the answer, and nowhere else (§8, §11)', () => {
    expect(TABLE.runs.map((run) => run.sum)).toEqual([3, 12, 21, 10, 13, 13]);
    expect(buildRuns(LAYOUT, [1, 2])).toBeNull();
    // A white cell the answer left blank is not an answer at all.
    expect(buildRuns(LAYOUT, gridOf('....', '.1..', '.345', '.678'))).toBeNull();
  });

  it('draws each clue cell’s two numbers, and nothing on a white cell (§1)', () => {
    const clues = clueTable(LAYOUT, TABLE);
    expect(clues[4]).toEqual({ right: 3, down: null });
    expect(clues[1]).toEqual({ right: null, down: 10 });
    expect(clues[7]).toEqual({ right: null, down: 13 });
    // A spacer: on the board but carrying neither sum.
    expect(clues[0]).toEqual({ right: null, down: null });
    expect(clues[5]).toBeNull();
  });

  /**
   * Every structural failure of §1 comes back as one null, because a caller
   * has nothing useful to do with a partial answer. §11 leans on exactly this:
   * a decoded layout that survives this call is one the game could have made.
   */
  const illegal: Array<[string, Layout]> = [
    [
      'a white cell in the left column, with nowhere to draw its clue',
      layoutOf('####', '...#', '#..#', '####'),
    ],
    [
      'a white cell in the top row, with nowhere to draw its clue',
      layoutOf('#.##', '#.##', '#.##', '####'),
    ],
    [
      'a run of one — a printed digit, not a cell to solve',
      layoutOf('####', '#.##', '#.##', '####'),
    ],
    [
      'a run of ten, which no legal filling exists for',
      layoutOf('###########', '#..........', '#..........'),
    ],
    [
      'white cells in two islands, which is two puzzles on one grid',
      layoutOf('######', '#..###', '#..###', '####..', '####..', '######'),
    ],
    ['a board with no white cells at all', layoutOf('####', '####', '####', '####')],
    [
      'a cells array that is not the size it claims',
      { width: 4, height: 4, cells: [BLOCK, WHITE] },
    ],
  ];
  for (const [name, layout] of illegal) {
    it(`refuses ${name}`, () => {
      expect(runGeometry(layout)).toBeNull();
    });
  }

  it('knows one region of white cells from two', () => {
    expect(isConnectedWhite(LAYOUT)).toBe(true);
    expect(
      isConnectedWhite(layoutOf('######', '#..###', '#..###', '####..', '####..', '######')),
    ).toBe(false);
    expect(isConnectedWhite(layoutOf('####', '####'))).toBe(false);
  });

  it('names the cells a digit may not repeat with: both runs, and nothing else (§3)', () => {
    // Cell 10 sits on the row run [9,10,11] and the column run [6,10,14].
    expect(peersOf(TABLE, 10).sort((a, b) => a - b)).toEqual([6, 9, 11, 14]);
    expect(peersOf(TABLE, 0)).toEqual([]);
  });
});

describe('writing a digit (§4)', () => {
  const board = createBoard(LAYOUT);

  it('writes into a white cell and reads back', () => {
    const result = place(board, TABLE, 5, 1, SOLUTION)!;
    expect(result.board.entries[5]).toBe(1);
    expect(result.mistake).toBe(false);
    expect(isComplete(result.board, TABLE)).toBe(false);
  });

  it('counts a digit that disagrees with the answer, and still writes it (§5)', () => {
    const result = place(board, TABLE, 5, 7, SOLUTION)!;
    expect(result.mistake).toBe(true);
    expect(result.board.entries[5]).toBe(7);
    expect(mistakenCells(result.board, SOLUTION)).toEqual(new Set([5]));
  });

  it('refuses a clue cell, a repeat of what is there, and an index off the board', () => {
    expect(place(board, TABLE, 0, 1, SOLUTION)).toBeNull();
    expect(place(board, TABLE, 4, 1, SOLUTION)).toBeNull();
    const written = place(board, TABLE, 5, 1, SOLUTION)!.board;
    expect(place(written, TABLE, 5, 1, SOLUTION)).toBeNull();
    expect(place(board, TABLE, -1, 1, SOLUTION)).toBeNull();
    expect(place(board, TABLE, 99, 1, SOLUTION)).toBeNull();
    expect(place(board, TABLE, 5, 0 as Digit, SOLUTION)).toBeNull();
  });

  /**
   * The bookkeeping that makes this game's undo worth having (§5): one digit
   * rubs out pencil marks across two whole runs, and nothing the player can
   * press brings them back. The reach is the run, never the row or the column
   * — the far side of a clue cell is a different run and keeps its notes (§4).
   */
  it('rubs the digit out of every note in both of its runs, and stops at the clue cell', () => {
    let noted = board;
    for (const index of [5, 6, 9, 11, 13, 14, 15]) noted = toggleNote(noted, TABLE, index, 3)!;
    noted = toggleNote(noted, TABLE, 9, 7)!;

    const after = place(noted, TABLE, 10, 3, SOLUTION)!.board;
    // Cell 10's runs are [9,10,11] and [6,10,14].
    expect([9, 11, 6, 14].map((index) => hasNote(after, index, 3))).toEqual([
      false,
      false,
      false,
      false,
    ]);
    // Cell 5 shares a row with 6 but sits behind a different clue, and 13 and
    // 15 share neither run — all three keep the note.
    expect([5, 13, 15].map((index) => hasNote(after, index, 3))).toEqual([true, true, true]);
    // Other digits in a stripped cell survive, and the written cell keeps none.
    expect(hasNote(after, 9, 7)).toBe(true);
    expect(after.notes[10]).toBe(0);
  });
});

describe('erasing and noting (§4)', () => {
  const board = createBoard(LAYOUT);

  it('clears an entry and its notes together', () => {
    const written = place(board, TABLE, 5, 1, SOLUTION)!.board;
    const cleared = erase(written, TABLE, 5)!;
    expect(cleared.entries[5]).toBe(EMPTY);
    expect(cleared.notes[5]).toBe(0);
  });

  it('refuses to erase a clue cell or a cell with nothing in it', () => {
    expect(erase(board, TABLE, 0)).toBeNull();
    expect(erase(board, TABLE, 5)).toBeNull();
  });

  it('toggles a note on and off again', () => {
    const on = toggleNote(board, TABLE, 5, 3)!;
    expect(hasNote(on, 5, 3)).toBe(true);
    expect(hasNote(toggleNote(on, TABLE, 5, 3)!, 5, 3)).toBe(false);
  });

  it('refuses a note on a clue cell or on a cell that already shows a digit', () => {
    expect(toggleNote(board, TABLE, 0, 3)).toBeNull();
    const written = place(board, TABLE, 5, 1, SOLUTION)!.board;
    expect(toggleNote(written, TABLE, 5, 3)).toBeNull();
  });
});

describe('the three violations, and only these three (§5)', () => {
  it('flags a digit written twice in one run — rule 1, whatever else is true', () => {
    // [9,10,11] is 12 across three cells: 3+3+6 adds to its clue exactly, and
    // is still wrong, because the two 3s are in one run (§3 rule 1).
    const violations = findViolations(gridOf('....', '....', '.336', '....'), TABLE);
    expect(violations.cells).toEqual(new Set([9, 10]));
    expect(violations.runs).toEqual(new Set([1]));
    expect(violations.any).toBe(true);
  });

  it('flags a part-filled run already past its clue, before it fills up', () => {
    // [5,6] is 3, and a 9 in the first cell has overshot it on its own.
    const violations = findViolations(gridOf('....', '.9..', '....', '....'), TABLE);
    expect(violations.cells).toEqual(new Set([5]));
    expect(violations.runs).toEqual(new Set([0]));
  });

  it('flags a full run that adds to the wrong number', () => {
    // [9,10,11] is 12; 1+2+3 is 6, so it is short and finished.
    const violations = findViolations(gridOf('....', '....', '.123', '....'), TABLE);
    expect(violations.cells).toEqual(new Set([9, 10, 11]));
    expect(violations.runs).toEqual(new Set([1]));
  });

  it('says nothing about a legal digit that happens to be wrong', () => {
    // 2 and 1 in [5,6] is a legal 3, and it is not the answer. §5 draws the
    // line at rule breaks; being wrong is the mistake display's business.
    const grid = gridOf('....', '.21.', '....', '....');
    expect(findViolations(grid, TABLE).any).toBe(false);
    expect(mistakenCells({ entries: grid, notes: [] }, SOLUTION)).toEqual(new Set([5, 6]));
  });

  /**
   * The deliberate omission of §5: [13,14,15] is 21, and with 1 and 2 written
   * the last cell would have to hold 18. The run is dead and the display says
   * nothing, because no rule has been broken in any of those cells yet. That
   * reasoning belongs to the Hint (§6) — the line is what keeps the violation
   * display from turning into a solver.
   */
  it('says nothing about a run that can no longer reach its clue', () => {
    expect(findViolations(gridOf('....', '....', '....', '.12.'), TABLE).any).toBe(false);
  });
});

describe('the win (§2)', () => {
  it('is a full board with nothing broken', () => {
    expect(isSolved(SOLUTION, TABLE)).toBe(true);
    expect(isComplete({ entries: SOLUTION, notes: [] }, TABLE)).toBe(true);
  });

  it('is not a board with a cell left empty', () => {
    const unfinished = [...SOLUTION];
    unfinished[10] = EMPTY;
    expect(isSolved(unfinished, TABLE)).toBe(false);
  });

  it('is not a full board that breaks a rule', () => {
    // Swapping 3 and 4 keeps both row sums and breaks both column runs.
    const broken = [...SOLUTION];
    broken[9] = 4;
    broken[10] = 3;
    expect(isSolved(broken, TABLE)).toBe(false);
    expect(findViolations(broken, TABLE).any).toBe(true);
  });
});

/**
 * `every` on an empty array is true and a short grid reads as all-empty, so
 * without explicit length and emptiness checks the emptiest possible board is
 * "solved" — which is how a generator that returned nothing would reach the
 * result screen as a win rather than as a crash. Takuzu shipped exactly this
 * bug and review caught it there; the same case is pinned here.
 */
describe('a board of the wrong length is not a win (§2)', () => {
  it('refuses an empty grid', () => {
    expect(isSolved([], TABLE)).toBe(false);
  });

  it('refuses a grid short by one cell', () => {
    expect(isSolved(SOLUTION.slice(0, -1), TABLE)).toBe(false);
  });

  it('refuses a table with no white cells, however clean it reads', () => {
    const nothing: RunTable = { runs: [], rowRun: [], colRun: [], white: [] };
    expect(isSolved([], nothing)).toBe(false);
    expect(isSolved(SOLUTION, nothing)).toBe(false);
    expect(findViolations([], nothing).any).toBe(false);
  });
});
