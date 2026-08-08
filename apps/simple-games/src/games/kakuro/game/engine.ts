/**
 * Board state and the board rules of docs/KAKURO_RULES.md §2, §3, §4 and §5:
 * reading the runs out of a layout, writing a digit, the notes that come with
 * it, the always-on violation display, and the win.
 *
 * Pure and immutable: every function returns a new board, or null when the
 * move is not allowed. A Kakuro hands the player no digits at all — the clues
 * are the whole of the puzzle — so unlike Sudoku and Futoshiki there is no
 * givens array here and a board is only `entries` and `notes`. That absence is
 * load-bearing in §11: "an entry sits on a clue cell" is the corruption test,
 * and there is no second class of fixed digit it could be confused with.
 *
 * Notes live here rather than in the state layer for the reason Sudoku's do:
 * writing a digit erases it from the notes of every cell in the same two runs
 * (§4), so notes are part of what a move means, not a view of it. What the
 * state layer owns is the note *mode* — which button the pad is in — and that
 * never reaches this file.
 */
import {
  ALL_DIGITS,
  BLOCK,
  EMPTY,
  MAX_RUN,
  MIN_RUN,
  WHITE,
  bitOf,
  cellCount,
  colOf,
  hasBit,
  isWhite,
  rowOf,
  type Clue,
  type Digit,
  type Layout,
  type Run,
  type RunGeometry,
  type RunShape,
  type RunTable,
} from './types';

/** The four orthogonal neighbours of a cell that stay on the board. */
function neighbours(layout: Layout, index: number): number[] {
  const row = rowOf(index, layout.width);
  const col = colOf(index, layout.width);
  const out: number[] = [];
  if (col > 0) out.push(index - 1);
  if (col < layout.width - 1) out.push(index + 1);
  if (row > 0) out.push(index - layout.width);
  if (row < layout.height - 1) out.push(index + layout.width);
  return out;
}

/**
 * Whether the white cells form one region (§1). Flood fill from the first
 * white cell and count what it reaches.
 *
 * This is a playability rule, not decoration. Two white regions with no cell
 * in common are two puzzles printed on one grid, and the player has no way to
 * tell which half a hint belongs to; more practically, an island of four cells
 * is nearly always ambiguous on its own. The generator maintains it as an
 * invariant and §11 refuses a save that breaks it.
 */
export function isConnectedWhite(layout: Layout): boolean {
  const total = layout.cells.reduce<number>((sum, kind) => sum + (kind === WHITE ? 1 : 0), 0);
  if (total === 0) return false;
  const start = layout.cells.indexOf(WHITE);
  const seen = new Array<boolean>(layout.cells.length).fill(false);
  seen[start] = true;
  const stack = [start];
  let reached = 0;
  while (stack.length > 0) {
    const index = stack.pop()!;
    reached++;
    for (const next of neighbours(layout, index)) {
      if (seen[next] || layout.cells[next] !== WHITE) continue;
      seen[next] = true;
      stack.push(next);
    }
  }
  return reached === total;
}

/**
 * The runs a layout describes, or null when the layout is not a Kakuro board
 * at all (§1).
 *
 * Null covers every structural failure in one answer, because a caller has
 * nothing useful to do with a partial one: a white cell in the top row or left
 * column (nowhere to draw its clue), a run of one cell (a given, not a
 * puzzle), a run of more than nine (it would have to repeat a digit, which §3
 * forbids, so no legal filling exists), or white cells in two separate
 * regions. §11 leans on exactly this: a decoded layout that survives this call
 * is one the game could have produced.
 */
export function runGeometry(layout: Layout): RunGeometry | null {
  const { width, height, cells } = layout;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 2 || height < 2 || cells.length !== width * height) return null;

  const shapes: RunShape[] = [];
  const rowRun = new Array<number>(cells.length).fill(-1);
  const colRun = new Array<number>(cells.length).fill(-1);
  const white: number[] = [];

  const close = (axis: 'row' | 'col', run: number[], assign: number[], step: number): boolean => {
    if (run.length === 0) return true;
    if (run.length < MIN_RUN || run.length > MAX_RUN) return false;
    const position = shapes.length;
    shapes.push({ axis, clue: run[0]! - step, cells: [...run] });
    for (const index of run) assign[index] = position;
    return true;
  };

  for (let row = 0; row < height; row++) {
    let run: number[] = [];
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      if (cells[index] === WHITE) {
        // A run starting in column 0 has no cell to carry its number.
        if (col === 0) return null;
        run.push(index);
        continue;
      }
      if (cells[index] !== BLOCK) return null;
      if (!close('row', run, rowRun, 1)) return null;
      run = [];
    }
    if (!close('row', run, rowRun, 1)) return null;
  }

  for (let col = 0; col < width; col++) {
    let run: number[] = [];
    for (let row = 0; row < height; row++) {
      const index = row * width + col;
      if (cells[index] === WHITE) {
        if (row === 0) return null;
        run.push(index);
        continue;
      }
      if (!close('col', run, colRun, width)) return null;
      run = [];
    }
    if (!close('col', run, colRun, width)) return null;
  }

  for (let index = 0; index < cells.length; index++) {
    if (cells[index] !== WHITE) continue;
    // Unreachable via the two sweeps above, which already refuse a short or
    // long run — kept because "every white cell is in exactly one run of each
    // axis" is the invariant the whole solver indexes by, and an assertion of
    // it here is cheaper than finding out inside a hot loop.
    if (rowRun[index] === -1 || colRun[index] === -1) return null;
    white.push(index);
  }
  if (white.length === 0) return null;
  if (!isConnectedWhite(layout)) return null;

  return { shapes, rowRun, colRun, white };
}

/**
 * The runs with their numbers: geometry from the layout, sums from the answer
 * (§1, §8).
 *
 * Nothing else in this game computes a clue. That is the whole point — a clue
 * is a fact about the layout and the solution together, so recomputing it here
 * every time makes "the clue disagrees with the answer" a state the game
 * cannot reach, in a save file or anywhere else (§11).
 */
export function buildRuns(layout: Layout, solution: readonly number[]): RunTable | null {
  const geometry = runGeometry(layout);
  if (geometry === null) return null;
  if (solution.length !== cellCount(layout)) return null;

  const runs: Run[] = [];
  for (const shape of geometry.shapes) {
    let sum = 0;
    for (const index of shape.cells) {
      const value = solution[index]!;
      if (!Number.isInteger(value) || value < 1 || value > 9) return null;
      sum += value;
    }
    runs.push({ ...shape, sum });
  }
  const { rowRun, colRun, white } = geometry;
  return { runs, rowRun, colRun, white };
}

/**
 * What each clue cell has to draw (§1): the sum of the run to its right, the
 * sum of the run below it, or neither for a plain spacer.
 *
 * One array with one slot per cell, so the board can render by index without
 * searching the run list per cell. White cells hold null.
 */
export function clueTable(layout: Layout, table: RunTable): (Clue | null)[] {
  const clues: (Clue | null)[] = new Array<Clue | null>(cellCount(layout)).fill(null);
  for (let index = 0; index < clues.length; index++) {
    if (!isWhite(layout, index)) clues[index] = { right: null, down: null };
  }
  for (const run of table.runs) {
    const current = clues[run.clue];
    if (!current) continue;
    clues[run.clue] =
      run.axis === 'row' ? { ...current, right: run.sum } : { ...current, down: run.sum };
  }
  return clues;
}

export interface Board {
  /** What the player has written, 0 for empty and for every clue cell. */
  readonly entries: readonly number[];
  /** Note masks per cell (bit 0 = digit 1). 0 on every clue cell. */
  readonly notes: readonly number[];
}

export function createBoard(layout: Layout): Board {
  const size = cellCount(layout);
  return {
    entries: new Array<number>(size).fill(EMPTY),
    notes: new Array<number>(size).fill(0),
  };
}

export const isComplete = (board: Board, table: RunTable): boolean =>
  table.white.every((index) => board.entries[index] !== EMPTY);

/**
 * The cells that may not repeat a digit with this one: the rest of its
 * horizontal run and the rest of its vertical run (§3).
 *
 * Computed per call rather than cached the way Futoshiki caches its four
 * sizes, because the peer set here depends on the layout — which is a
 * different board every level, not one of four shapes.
 */
export function peersOf(table: RunTable, index: number): number[] {
  const out: number[] = [];
  for (const position of [table.rowRun[index], table.colRun[index]]) {
    if (position === undefined || position < 0) continue;
    for (const peer of table.runs[position]!.cells) if (peer !== index) out.push(peer);
  }
  return out;
}

export interface PlaceResult {
  readonly board: Board;
  /** True when the digit disagrees with the solution — counted, not punished. */
  readonly mistake: boolean;
}

/**
 * Writes a digit into a white cell. Returns null for a clue cell, an index off
 * the board, or a no-op (the same digit already there).
 *
 * A wrong digit is allowed and counted. The game never blocks a move and never
 * ends because of one (§5) — showing it is a display setting the state layer
 * owns, not a rule this layer enforces.
 */
export function place(
  board: Board,
  table: RunTable,
  index: number,
  digit: Digit,
  solution: readonly number[],
): PlaceResult | null {
  if (index < 0 || index >= board.entries.length) return null;
  if (table.rowRun[index] === undefined || table.rowRun[index]! < 0) return null;
  if (digit < 1 || digit > 9) return null;
  if (board.entries[index] === digit) return null;

  const entries = [...board.entries];
  entries[index] = digit;

  const notes = [...board.notes];
  notes[index] = 0;
  // Neither run can hold this digit again, so the pencil mark goes with it —
  // the bookkeeping a person would otherwise do by hand (§4).
  const remove = ~bitOf(digit);
  for (const peer of peersOf(table, index)) {
    if (notes[peer] !== 0) notes[peer] = notes[peer]! & remove;
  }

  return { board: { entries, notes }, mistake: solution[index] !== digit };
}

/** Clears a white cell and its notes. Null when there is nothing to clear. */
export function erase(board: Board, table: RunTable, index: number): Board | null {
  if (index < 0 || index >= board.entries.length) return null;
  if (table.rowRun[index] === undefined || table.rowRun[index]! < 0) return null;
  if (board.entries[index] === EMPTY && board.notes[index] === 0) return null;
  const entries = [...board.entries];
  const notes = [...board.notes];
  entries[index] = EMPTY;
  notes[index] = 0;
  return { entries, notes };
}

/**
 * Adds or removes one note digit. Null for a clue cell or one that already
 * holds an entry — a note there would contradict what is shown.
 */
export function toggleNote(
  board: Board,
  table: RunTable,
  index: number,
  digit: Digit,
): Board | null {
  if (index < 0 || index >= board.entries.length) return null;
  if (table.rowRun[index] === undefined || table.rowRun[index]! < 0) return null;
  if (digit < 1 || digit > 9) return null;
  if (board.entries[index] !== EMPTY) return null;
  const notes = [...board.notes];
  notes[index] = (notes[index]! ^ bitOf(digit)) & ALL_DIGITS;
  return { entries: board.entries, notes };
}

export const hasNote = (board: Board, index: number, digit: Digit): boolean =>
  hasBit(board.notes[index] ?? 0, digit);

/**
 * What the board currently breaks (§5), per cell so the board can tint the
 * offending digits and per run so the clue can tint with them.
 *
 * Three things, and only these three (§5):
 *
 * - a digit written twice in one run — always wrong, whatever else happens;
 * - a part-filled run whose digits already add past its clue — wrong now,
 *   because every remaining cell has to add at least one more;
 * - a full run adding to the wrong number.
 *
 * Deliberately absent: "this run can no longer reach its clue with the digits
 * left". It is true reasoning and the solver uses it, but as a violation it
 * would tint cells the player has not written anything wrong in yet, which is
 * a different promise from "you broke a rule here". §5 draws the line at rule
 * breaks; the reasoning stays in the Hint.
 *
 * This is a statement about the rules, not a comparison against the hidden
 * solution: a player who writes a legal-but-not-final digit is told nothing by
 * this function, because nothing is wrong yet. Telling them is `mistakenCells`,
 * which the state layer only calls when the player has that setting on (§5).
 */
export interface Violations {
  readonly cells: ReadonlySet<number>;
  /** Indices into `table.runs`, so the UI can tint the clue itself. */
  readonly runs: ReadonlySet<number>;
  /** True when anything at all is flagged — the cheap read for the hint (§6). */
  readonly any: boolean;
}

export function findViolations(entries: readonly number[], table: RunTable): Violations {
  const cells = new Set<number>();
  const broken = new Set<number>();

  table.runs.forEach((run, position) => {
    const seen = new Map<number, number[]>();
    let sum = 0;
    let filled = 0;
    for (const index of run.cells) {
      const value = entries[index] ?? EMPTY;
      if (value === EMPTY) continue;
      filled++;
      sum += value;
      const held = seen.get(value);
      if (held) held.push(index);
      else seen.set(value, [index]);
    }

    let bad = false;
    for (const held of seen.values()) {
      if (held.length < 2) continue;
      bad = true;
      for (const index of held) cells.add(index);
    }
    if (sum > run.sum || (filled === run.cells.length && sum !== run.sum)) {
      bad = true;
      for (const index of run.cells) if ((entries[index] ?? EMPTY) !== EMPTY) cells.add(index);
    }
    if (bad) broken.add(position);
  });

  return { cells, runs: broken, any: cells.size > 0 };
}

/** Player entries that disagree with the one solution (§5). */
export function mistakenCells(board: Board, solution: readonly number[]): ReadonlySet<number> {
  const wrong = new Set<number>();
  for (let index = 0; index < board.entries.length; index++) {
    const entry = board.entries[index]!;
    if (entry !== EMPTY && entry !== solution[index]) wrong.add(index);
  }
  return wrong;
}

/**
 * Won when every white cell is filled and nothing is broken (§2): every run
 * adds to its clue with no digit used twice.
 *
 * Read through `findViolations` on purpose, so the display and the verdict can
 * never disagree — a board the player is told is clean but that refuses to
 * finish would be the worst bug this game could have. The two readings do
 * coincide: on a full run "no repeat" and "adds to the clue" is exactly §3.
 */
export function isSolved(entries: readonly number[], table: RunTable): boolean {
  // The length check is not about the cells this function reads — it reads only
  // the white ones and would be right about every one of them. It is about the
  // ones it does not: a grid carrying extra cells past the end of the table is
  // not this board, and answering "solved" for it says the caller's grid and
  // this layout are the same thing when they are not. `isFullyDetermined`
  // (solver.ts) guards identically.
  if (entries.length !== table.rowRun.length) return false;
  if (table.white.length === 0) return false;
  if (table.white.some((index) => (entries[index] ?? EMPTY) === EMPTY)) return false;
  return !findViolations(entries, table).any;
}
