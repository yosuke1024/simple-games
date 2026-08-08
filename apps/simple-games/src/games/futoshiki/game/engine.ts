/**
 * Board state and the board rules of docs/FUTOSHIKI_RULES.md §2, §3, §4 and
 * §5: writing a digit, the notes that come with it, the always-on violation
 * display, and the win.
 *
 * Pure and immutable: every function returns a new board, or null when the
 * move is not allowed. The player's board is three arrays — `givens` for the
 * cells the puzzle fixed, `entries` for what the player wrote, `notes` for the
 * candidate masks the player keeps — and a given never carries an entry. That
 * separation is what lets §11 state its fail-closed invariant as a fact about
 * the data (an entry on top of a given is corruption, not a move) instead of
 * as a rule someone has to remember.
 *
 * Notes live here rather than in the state layer for the reason Sudoku's do:
 * placing a digit erases it from the notes of every cell in the same row and
 * column (§4), so notes are part of what a move means, not a view of it. What
 * the state layer owns is the note *mode* — which button the pad is in — and
 * that never reaches this file.
 */
import {
  EMPTY,
  bitOf,
  cellCount,
  colOf,
  hasBit,
  rowOf,
  type Constraint,
  type Digit,
  type Grid,
  type Line,
  type Size,
} from './types';

export const rowIndices = (size: number, row: number): number[] =>
  Array.from({ length: size }, (_, col) => row * size + col);

export const colIndices = (size: number, col: number): number[] =>
  Array.from({ length: size }, (_, row) => row * size + col);

/** The indices of one line, whichever axis it runs along. */
export const lineIndices = (size: number, line: Line): number[] =>
  line.axis === 'row' ? rowIndices(size, line.index) : colIndices(size, line.index);

/** Every line of one size, rows first — the order a technique sweeps them in. */
function buildLines(size: Size): readonly Line[] {
  const lines: Line[] = [];
  for (let index = 0; index < size; index++) lines.push({ axis: 'row', index });
  for (let index = 0; index < size; index++) lines.push({ axis: 'col', index });
  return lines;
}

/**
 * The cells that may not repeat a digit with this one: its row and its column
 * (§3). There are no boxes — that is Sudoku, and the deliberate difference is
 * in §14.
 */
function buildPeers(size: Size): readonly (readonly number[])[] {
  const peers: number[][] = [];
  for (let index = 0; index < cellCount(size); index++) {
    const row = rowOf(index, size);
    const col = colOf(index, size);
    const set = [...rowIndices(size, row), ...colIndices(size, col)].filter(
      (peer) => peer !== index,
    );
    peers.push([...new Set(set)]);
  }
  return peers;
}

interface Tables {
  readonly lines: readonly Line[];
  readonly lineCells: readonly (readonly number[])[];
  readonly peers: readonly (readonly number[])[];
}

/** Built once per size: four sizes, so the whole cache is four entries. */
const tables = new Map<Size, Tables>();

export function tablesFor(size: Size): Tables {
  const cached = tables.get(size);
  if (cached !== undefined) return cached;
  const lines = buildLines(size);
  const built: Tables = {
    lines,
    lineCells: lines.map((line) => lineIndices(size, line)),
    peers: buildPeers(size),
  };
  tables.set(size, built);
  return built;
}

export const peersOf = (size: Size, index: number): readonly number[] =>
  tablesFor(size).peers[index] ?? [];

export interface Board {
  /** The digits the puzzle fixed, 0 elsewhere. Never changes during a game. */
  readonly givens: Grid;
  /** What the player has written, 0 for empty. Given cells stay 0 here. */
  readonly entries: Grid;
  /** Note masks per cell (bit 0 = digit 1). */
  readonly notes: readonly number[];
}

export function createBoard(givens: Grid): Board {
  return {
    givens,
    entries: new Array<number>(givens.length).fill(EMPTY),
    notes: new Array<number>(givens.length).fill(0),
  };
}

export const isGiven = (board: Board, index: number): boolean => board.givens[index] !== EMPTY;

/** The digit shown in a cell — a given, the player's entry, or 0. */
export const valueAt = (board: Board, index: number): number =>
  board.givens[index] !== EMPTY ? board.givens[index]! : (board.entries[index] ?? EMPTY);

/** The board as one grid: the reading everything else works on. */
export function toGrid(board: Board): number[] {
  return board.givens.map((given, index) => (given !== EMPTY ? given : board.entries[index]!));
}

export const isComplete = (board: Board): boolean =>
  board.givens.every((_, index) => valueAt(board, index) !== EMPTY);

/** How many of a digit are on the board — the pad shows N minus this (§4). */
export function digitCount(board: Board, digit: Digit): number {
  let count = 0;
  for (let index = 0; index < board.givens.length; index++) {
    if (valueAt(board, index) === digit) count++;
  }
  return count;
}

/**
 * How many of a digit are still to be placed (§4).
 *
 * Unlike Kakuro this invariant exists: a solved board holds every digit
 * exactly N times, once per row (§3), so "N minus what is on the board" is a
 * fact rather than an estimate — which is why this game's pad shows it.
 */
export const remainingForDigit = (board: Board, size: Size, digit: Digit): number =>
  size - digitCount(board, digit);

export interface PlaceResult {
  readonly board: Board;
  /** True when the digit disagrees with the solution — counted, not punished. */
  readonly mistake: boolean;
}

/**
 * Writes a digit into a player cell. Returns null for a given cell or a no-op
 * (the same digit already there).
 *
 * A wrong digit is allowed and counted. The game never blocks a move and never
 * ends because of one (§5) — showing it is a display setting the state layer
 * owns, not a rule this layer enforces.
 */
export function place(
  board: Board,
  size: Size,
  index: number,
  digit: Digit,
  solution: Grid,
): PlaceResult | null {
  if (index < 0 || index >= board.givens.length) return null;
  if (isGiven(board, index)) return null;
  if (board.entries[index] === digit) return null;

  const entries = [...board.entries];
  entries[index] = digit;

  const notes = [...board.notes];
  notes[index] = 0;
  // The row and the column can no longer hold this digit, so the pencil mark
  // goes with it — the bookkeeping a person would otherwise do by hand (§4).
  const remove = ~bitOf(digit);
  for (const peer of peersOf(size, index)) {
    if (notes[peer] !== 0) notes[peer] = notes[peer]! & remove;
  }

  return { board: { givens: board.givens, entries, notes }, mistake: solution[index] !== digit };
}

/** Clears a player entry and its notes. Null when there is nothing to clear. */
export function erase(board: Board, index: number): Board | null {
  if (index < 0 || index >= board.givens.length) return null;
  if (isGiven(board, index)) return null;
  if (board.entries[index] === EMPTY && board.notes[index] === 0) return null;
  const entries = [...board.entries];
  const notes = [...board.notes];
  entries[index] = EMPTY;
  notes[index] = 0;
  return { givens: board.givens, entries, notes };
}

/**
 * Adds or removes one note digit. Null for a given cell or one that already
 * holds an entry — a note there would contradict what is shown.
 */
export function toggleNote(board: Board, index: number, digit: Digit): Board | null {
  if (index < 0 || index >= board.givens.length) return null;
  if (isGiven(board, index)) return null;
  if (board.entries[index] !== EMPTY) return null;
  const notes = [...board.notes];
  notes[index] = notes[index]! ^ bitOf(digit);
  return { givens: board.givens, entries: board.entries, notes };
}

export const hasNote = (board: Board, index: number, digit: Digit): boolean =>
  hasBit(board.notes[index] ?? 0, digit);

/**
 * What the board currently breaks (§5), per cell so the board can tint the
 * offending digits and per sign so the gap between two cells can tint with
 * them.
 *
 * This is a statement about the rules, not a comparison against the hidden
 * solution: a player who writes a legal-but-not-final digit is told nothing by
 * this function, because nothing is wrong yet. Telling them is
 * `mistakenCells`, which the state layer only calls when the player has that
 * setting on (§5).
 */
export interface Violations {
  readonly cells: ReadonlySet<number>;
  /** Indices into the puzzle's sign list, so the UI can tint the sign itself. */
  readonly constraints: ReadonlySet<number>;
  /** True when anything at all is flagged — the cheap read for the hint (§6). */
  readonly any: boolean;
}

export function findViolations(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
): Violations {
  const cells = new Set<number>();
  const broken = new Set<number>();

  for (const indices of tablesFor(size).lineCells) {
    const seen = new Map<number, number[]>();
    for (const index of indices) {
      const value = grid[index] ?? EMPTY;
      if (value === EMPTY) continue;
      const held = seen.get(value);
      if (held) held.push(index);
      else seen.set(value, [index]);
    }
    for (const held of seen.values()) {
      if (held.length > 1) for (const index of held) cells.add(index);
    }
  }

  // A sign is only broken once both of its cells hold a digit. One filled cell
  // says nothing yet — the other one still has every digit open to it.
  constraints.forEach((constraint, position) => {
    const low = grid[constraint.less] ?? EMPTY;
    const high = grid[constraint.greater] ?? EMPTY;
    if (low === EMPTY || high === EMPTY || low < high) return;
    broken.add(position);
    cells.add(constraint.less);
    cells.add(constraint.greater);
  });

  return { cells, constraints: broken, any: cells.size > 0 };
}

/** Player entries that disagree with the one solution (§5). */
export function mistakenCells(board: Board, solution: Grid): ReadonlySet<number> {
  const wrong = new Set<number>();
  for (let index = 0; index < board.entries.length; index++) {
    const entry = board.entries[index]!;
    if (entry !== EMPTY && entry !== solution[index]) wrong.add(index);
  }
  return wrong;
}

/**
 * Won when the grid is full and nothing is broken (§2): every row and column
 * holds 1..N once, and every sign reads the way it points.
 *
 * Read through `findViolations` on purpose, so the display and the verdict can
 * never disagree — a board the player is told is clean but that refuses to
 * finish would be the worst bug this game could have. The two readings do
 * coincide: on a full line "no digit twice" over N cells and N digits forces
 * each digit exactly once.
 */
export function isSolved(grid: Grid, size: Size, constraints: readonly Constraint[]): boolean {
  if (grid.length !== cellCount(size)) return false;
  if (grid.some((value) => value === EMPTY)) return false;
  return !findViolations(grid, size, constraints).any;
}
