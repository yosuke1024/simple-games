/**
 * The board rules of docs/NONOGRAM_RULES.md §1, §2 and §3: clues, marks, and
 * the win condition. Pure functions over flat arrays — no cell objects, no
 * state, nothing to keep in sync.
 *
 * Winning compares the painted runs to the clues, never to the hidden solution
 * (§2). Generation guarantees a unique solution (§4), so the two readings are
 * the same board in practice — but the clue reading is the honest one: it is
 * exactly what the player was asked to satisfy.
 */
import {
  CROSSED,
  FILLED,
  PAINTED,
  UNKNOWN,
  type Cell,
  type Clue,
  type Mark,
} from './types';

export const rowOf = (index: number, size: number): number => Math.floor(index / size);
export const colOf = (index: number, size: number): number => index % size;

/** The row-major indices of one row. */
export function rowIndices(size: number, row: number): number[] {
  const out: number[] = [];
  for (let col = 0; col < size; col++) out.push(row * size + col);
  return out;
}

/** The row-major indices of one column. */
export function colIndices(size: number, col: number): number[] {
  const out: number[] = [];
  for (let row = 0; row < size; row++) out.push(row * size + col);
  return out;
}

/** The run lengths of one solution line, in order. An empty line is `[]`. */
export function clueOfLine(line: readonly Cell[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const cell of line) {
    if (cell === PAINTED) {
      run++;
    } else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

export interface Clues {
  readonly rows: readonly Clue[];
  readonly cols: readonly Clue[];
}

/** Every row's and column's clue, straight from the solution (§1). */
export function computeClues(solution: readonly Cell[], size: number): Clues {
  const rows: Clue[] = [];
  const cols: Clue[] = [];
  for (let i = 0; i < size; i++) {
    rows.push(clueOfLine(rowIndices(size, i).map((index) => solution[index] ?? 0)));
    cols.push(clueOfLine(colIndices(size, i).map((index) => solution[index] ?? 0)));
  }
  return { rows, cols };
}

/** The painted runs of one marked line — crosses and unknowns both break runs. */
export function runsOfMarks(marks: readonly Mark[], indices: readonly number[]): number[] {
  const runs: number[] = [];
  let run = 0;
  for (const index of indices) {
    if (marks[index] === FILLED) {
      run++;
    } else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

const sameRuns = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * Whether one line currently reads exactly as its clue (§3). Used both for the
 * quiet clue dimming and, across every line, for the win itself (§2).
 */
export function lineSatisfied(
  marks: readonly Mark[],
  indices: readonly number[],
  clue: Clue,
): boolean {
  return sameRuns(runsOfMarks(marks, indices), clue);
}

/** Won when every row and every column reads as its clue (§2). */
export function isSolved(marks: readonly Mark[], clues: Clues, size: number): boolean {
  for (let i = 0; i < size; i++) {
    if (!lineSatisfied(marks, rowIndices(size, i), clues.rows[i] ?? [])) return false;
    if (!lineSatisfied(marks, colIndices(size, i), clues.cols[i] ?? [])) return false;
  }
  return true;
}

/** An empty player board: every cell undecided. */
export function emptyMarks(size: number): Mark[] {
  return new Array<Mark>(size * size).fill(UNKNOWN);
}

/**
 * Paint / unpaint one cell (§3). A cross is overwritten — the newest intent
 * wins. Returns null when the index is out of range.
 */
export function togglePaint(marks: readonly Mark[], index: number): Mark[] | null {
  if (index < 0 || index >= marks.length) return null;
  const next = [...marks];
  next[index] = marks[index] === FILLED ? UNKNOWN : FILLED;
  return next;
}

/** Cross / uncross one cell (§3). Paint is overwritten, same as above. */
export function toggleCross(marks: readonly Mark[], index: number): Mark[] | null {
  if (index < 0 || index >= marks.length) return null;
  const next = [...marks];
  next[index] = marks[index] === CROSSED ? UNKNOWN : CROSSED;
  return next;
}
