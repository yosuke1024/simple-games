/**
 * The line solver — the single inference rule of docs/NONOGRAM_RULES.md §4.
 *
 * For one line, every placement of the clue runs that is consistent with the
 * cells already decided is enumerated; a cell painted in all of them is
 * decided painted, a cell empty in all of them is decided crossed. Applied to
 * every row and column until nothing more moves. A puzzle this loop finishes
 * is solvable line by line, with no guessing and exactly one solution — which
 * is the only kind of puzzle the generator is allowed to ship (§5).
 *
 * The enumeration is plain recursion. On a 10-cell line the placement count is
 * bounded by C(10, 5) = 252, so there is nothing here worth memoizing (§1
 * caps the board at 10×10).
 */
import { colIndices, rowIndices } from './engine';
import { CROSSED, FILLED, UNKNOWN, type Clue, type Mark } from './types';

/** What one line's enumeration decided. Null when no placement fits (§7). */
export function solveLine(
  cells: readonly Mark[],
  clue: Clue,
): { readonly decided: Mark[]; readonly changed: boolean } | null {
  const n = cells.length;
  const canPaint = new Array<boolean>(n).fill(false);
  const canLeave = new Array<boolean>(n).fill(false);
  let placements = 0;

  /** Painted flags of the cells before the current recursion frontier. */
  const laid = new Array<boolean>(n).fill(false);

  const place = (from: number, run: number): void => {
    if (run >= clue.length) {
      // Every remaining cell stays unpainted — refused if one is painted.
      for (let i = from; i < n; i++) if (cells[i] === FILLED) return;
      placements++;
      for (let i = 0; i < n; i++) {
        if (i < from && laid[i]) canPaint[i] = true;
        else canLeave[i] = true;
      }
      return;
    }

    const length = clue[run] ?? 0;
    for (let start = from; start + length <= n; start++) {
      // A painted cell in the gap forces the run to start at or before it, so
      // this start and every later one are impossible.
      let blocked = false;
      for (let i = from; i < start; i++) {
        if (cells[i] === FILLED) {
          blocked = true;
          break;
        }
      }
      if (blocked) break;

      let fits = true;
      for (let i = start; i < start + length; i++) {
        if (cells[i] === CROSSED) {
          fits = false;
          break;
        }
      }
      // Runs are maximal: the cell after this one must not be painted.
      if (fits && start + length < n && cells[start + length] === FILLED) fits = false;
      if (!fits) continue;

      for (let i = start; i < start + length; i++) laid[i] = true;
      place(start + length + 1, run + 1);
      for (let i = start; i < start + length; i++) laid[i] = false;
    }
  };
  place(0, 0);

  if (placements === 0) return null;

  const decided = [...cells];
  let changed = false;
  for (let i = 0; i < n; i++) {
    if (cells[i] !== UNKNOWN) continue;
    if (canPaint[i] && !canLeave[i]) {
      decided[i] = FILLED;
      changed = true;
    } else if (!canPaint[i] && canLeave[i]) {
      decided[i] = CROSSED;
      changed = true;
    }
  }
  return { decided, changed };
}

export interface SolveResult {
  readonly marks: readonly Mark[];
  /** Every cell decided — the puzzle is line-solvable and unique (§4). */
  readonly solved: boolean;
  /** Some line admitted no placement at all — the marks contradict the clues. */
  readonly contradiction: boolean;
}

/**
 * Runs the line rule over every row and column to a fixpoint (§4), starting
 * from the given marks (empty marks for generation; the player's marks for
 * hints, §7).
 */
export function solve(
  start: readonly Mark[],
  rowClues: readonly Clue[],
  colClues: readonly Clue[],
  size: number,
): SolveResult {
  const marks = [...start];
  let moved = true;
  while (moved) {
    moved = false;
    for (let i = 0; i < size; i++) {
      for (const [indices, clue] of [
        [rowIndices(size, i), rowClues[i] ?? []],
        [colIndices(size, i), colClues[i] ?? []],
      ] as const) {
        const line = indices.map((index) => marks[index] ?? UNKNOWN);
        const result = solveLine(line, clue);
        if (result === null) return { marks, solved: false, contradiction: true };
        if (!result.changed) continue;
        moved = true;
        indices.forEach((index, k) => {
          marks[index] = result.decided[k] ?? UNKNOWN;
        });
      }
    }
  }
  return {
    marks,
    solved: marks.every((mark) => mark !== UNKNOWN),
    contradiction: false,
  };
}

export type Hint =
  /** One newly decided cell, and the line that proves it (§7). */
  | {
      readonly kind: 'cell';
      readonly index: number;
      readonly mark: Mark;
      readonly line: { readonly axis: 'row' | 'col'; readonly index: number };
    }
  /** No cell can move because this line no longer fits its clue (§7). */
  | { readonly kind: 'contradiction'; readonly axis: 'row' | 'col'; readonly index: number };

/**
 * The teaching hint of §7: the first cell one line decides from the player's
 * current marks — never a lookup into the hidden solution.
 *
 * A broken line outranks every cell: once some line no longer fits its clue,
 * any deduction elsewhere is built on marks that are already wrong, so the
 * honest hint is the break itself. Null when nothing is found at all (rare;
 * only wrong-but-consistent marks can cause it).
 */
export function findHint(
  marks: readonly Mark[],
  rowClues: readonly Clue[],
  colClues: readonly Clue[],
  size: number,
): Hint | null {
  let cell: Hint | null = null;
  for (let i = 0; i < size; i++) {
    for (const [axis, indices, clue] of [
      ['row', rowIndices(size, i), rowClues[i] ?? []],
      ['col', colIndices(size, i), colClues[i] ?? []],
    ] as const) {
      const line = indices.map((index) => marks[index] ?? UNKNOWN);
      const result = solveLine(line, clue);
      if (result === null) return { kind: 'contradiction', axis, index: i };
      if (cell !== null || !result.changed) continue;
      const k = result.decided.findIndex((mark, j) => mark !== line[j]);
      const index = indices[k];
      const mark = result.decided[k];
      if (index === undefined || mark === undefined) continue;
      cell = { kind: 'cell', index, mark, line: { axis, index: i } };
    }
  }
  return cell;
}
