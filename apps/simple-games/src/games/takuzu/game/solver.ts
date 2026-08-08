/**
 * The human-technique solver — the "no guessing" guarantee of
 * docs/TAKUZU_RULES.md §5.
 *
 * Three techniques, and nothing else. They are the same three a person uses,
 * in the order a person reaches for them, and they are shared by all three
 * callers that must agree: the generator only ships a puzzle this solver
 * finishes (§6), `guarantee.test.ts` re-checks that on every level, and the
 * Hint hands the player the next step this solver would take (§8). One
 * implementation means the promise, the check and the help cannot drift apart
 * — Sudoku §8 makes the same argument for its grader.
 *
 * Each technique is sound: it only ever writes a digit that every legal
 * completion of the board agrees on. So a board this solver fills has exactly
 * one solution, and no puzzle needs to be guessed at.
 */
import { findViolations, lineIndices } from './engine';
import {
  EMPTY,
  ONE,
  ZERO,
  cellCount,
  halfLine,
  isWritten,
  other,
  type Cell,
  type Line,
  type Mark,
  type Size,
} from './types';

/**
 * The three techniques, cheapest first (§5). The names travel to the Hint,
 * which turns them into plain sentences — the UI never shows the name itself.
 */
export type Technique = 'no-triple' | 'line-count' | 'unique-line';

/** One cell proved, with everything the Hint needs to explain it (§8). */
export interface SolveStep {
  /** Row-major index of the cell this proves. */
  readonly index: number;
  readonly value: Cell;
  readonly technique: Technique;
  /** The row or column the deduction was read off. */
  readonly line: Line;
  /**
   * The finished line the deduction plays against — only 'unique-line' has
   * one, because only rule 3 compares two lines. Null otherwise.
   */
  readonly against: Line | null;
  /** The already-written cells that carry the proof — what a hint highlights. */
  readonly support: readonly number[];
}

/**
 * Lines examined since the last reset — the unit of work generation is
 * budgeted in.
 *
 * Digging a puzzle is a few dozen full solves, and a solve is a stack of
 * sweeps over every row and column; the cost of both is the number of lines
 * read. A stopwatch measures that work times whatever else the machine happens
 * to be doing, and under `pnpm test` that is six other vitest forks. This
 * counts the work itself, and a seed always produces the same count on any
 * machine, which is what makes the §6 budget assertable rather than merely
 * observable. The reasoning is Sudoku §7's, verbatim; so is the rule that wall
 * clock is printed and never asserted.
 *
 * Nothing at runtime reads it; it costs one integer increment per line.
 */
let lineReads = 0;

export const solverWork = {
  read: (): number => lineReads,
  reset: (): void => {
    lineReads = 0;
  },
};

/**
 * Line descriptors and their index tables, built once per size. Rows first,
 * then columns, so a same-axis pair is a pair inside one half of the list —
 * which is what rule 3's technique walks.
 */
interface LineTable {
  readonly lines: readonly Line[];
  readonly indices: readonly (readonly number[])[];
}

const tables = new Map<Size, LineTable>();

function tableFor(size: Size): LineTable {
  const cached = tables.get(size);
  if (cached !== undefined) return cached;
  const lines: Line[] = [];
  for (let index = 0; index < size; index++) lines.push({ axis: 'row', index });
  for (let index = 0; index < size; index++) lines.push({ axis: 'col', index });
  const table: LineTable = { lines, indices: lines.map((line) => lineIndices(size, line)) };
  tables.set(size, table);
  return table;
}

/**
 * Technique 1 — the pair and the gap (§5). Inside any three neighbouring
 * cells, two equal digits and one empty leave the empty one no choice: the
 * matching digit would be three in a row. `1 1 _` and `_ 1 1` and `1 _ 1` are
 * the same rule read from three positions.
 */
function noTripleSteps(board: readonly Mark[], size: Size, firstOnly: boolean): SolveStep[] {
  const { lines, indices } = tableFor(size);
  const out: SolveStep[] = [];
  for (let k = 0; k < lines.length; k++) {
    lineReads++;
    const cells = indices[k]!;
    for (let i = 0; i + 2 < size; i++) {
      const first = cells[i]!;
      const middle = cells[i + 1]!;
      const last = cells[i + 2]!;
      const a = board[first]!;
      const b = board[middle]!;
      const c = board[last]!;

      let hole: number;
      let pair: readonly number[];
      let digit: Cell;
      if (a === EMPTY && isWritten(b) && b === c) {
        hole = first;
        pair = [middle, last];
        digit = b;
      } else if (b === EMPTY && isWritten(a) && a === c) {
        hole = middle;
        pair = [first, last];
        digit = a;
      } else if (c === EMPTY && isWritten(a) && a === b) {
        hole = last;
        pair = [first, middle];
        digit = a;
      } else {
        continue;
      }

      out.push({
        index: hole,
        value: other(digit),
        technique: 'no-triple',
        line: lines[k]!,
        against: null,
        support: pair,
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * Technique 2 — counting the line (§5). A line holds exactly half zeros and
 * half ones, so once half of it is one digit, everything still empty is the
 * other one.
 */
function lineCountSteps(board: readonly Mark[], size: Size, firstOnly: boolean): SolveStep[] {
  const half = halfLine(size);
  const { lines, indices } = tableFor(size);
  const out: SolveStep[] = [];
  for (let k = 0; k < lines.length; k++) {
    lineReads++;
    const cells = indices[k]!;
    let zeros = 0;
    let ones = 0;
    for (let i = 0; i < size; i++) {
      const value = board[cells[i]!]!;
      if (value === ZERO) zeros++;
      else if (value === ONE) ones++;
    }
    // A full line has half of each and nothing to say; an over-full one is
    // already a violation, which is §9's business rather than this one's.
    if (zeros + ones === size) continue;
    if (zeros !== half && ones !== half) continue;

    const digit: Cell = zeros === half ? ZERO : ONE;
    const support = cells.filter((index) => board[index] === digit);
    for (let i = 0; i < size; i++) {
      const index = cells[i]!;
      if (board[index] !== EMPTY) continue;
      out.push({
        index,
        value: other(digit),
        technique: 'line-count',
        line: lines[k]!,
        against: null,
        support,
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * Technique 3 — no line twice (§5). A line two cells short of finished has
 * exactly two ways to end, one zero and one one between the gaps; if a
 * finished line on the same axis already reads as one of them, rule 3 forbids
 * it and the other way is forced.
 *
 * Two guards make this sound. The line must be short of exactly one zero and
 * one one — otherwise counting settles it, and the "two ways" reasoning does
 * not hold. And the finished line has to agree on every cell already written,
 * or it was never one of the two ways to begin with.
 *
 * A line one cell short needs no rule of its own: with an odd number of cells
 * written its two counts cannot be equal, so technique 2 has already fired and
 * this sweep never sees it.
 */
function uniqueLineSteps(board: readonly Mark[], size: Size, firstOnly: boolean): SolveStep[] {
  const half = halfLine(size);
  const { lines, indices } = tableFor(size);
  const out: SolveStep[] = [];

  // Rows, then columns: rule 3 only ever compares two lines of the same axis.
  for (const base of [0, size]) {
    const contents = Array.from({ length: size }, (_, i) =>
      indices[base + i]!.map((index) => board[index] ?? EMPTY),
    );

    for (let a = 0; a < size; a++) {
      const target = contents[a]!;
      const holes = target.reduce<number[]>((acc, value, i) => {
        if (value === EMPTY) acc.push(i);
        return acc;
      }, []);
      if (holes.length !== 2) continue;
      const zeros = target.filter((value) => value === ZERO).length;
      const ones = target.filter((value) => value === ONE).length;
      if (zeros !== half - 1 || ones !== half - 1) continue;

      for (let b = 0; b < size; b++) {
        if (b === a) continue;
        lineReads++;
        const rival = contents[b]!;
        if (rival.some((value) => value === EMPTY)) continue;
        if (!target.every((value, i) => value === EMPTY || value === rival[i])) continue;

        const line = lines[base + a]!;
        const against = lines[base + b]!;
        for (const hole of holes) {
          const banned = rival[hole];
          if (!isWritten(banned)) continue;
          out.push({
            index: indices[base + a]![hole]!,
            value: other(banned),
            technique: 'unique-line',
            line,
            against,
            support: [...indices[base + b]!],
          });
          if (firstOnly) return out;
        }
        break;
      }
    }
  }
  return out;
}

/**
 * Everything the techniques can prove from this board in one sweep, cheapest
 * technique first. A more expensive technique is only consulted once the
 * cheaper ones have nothing left to say, which is both how a person plays and
 * why the work counter stays small.
 */
export function findSteps(board: readonly Mark[], size: Size, firstOnly = false): SolveStep[] {
  const triples = noTripleSteps(board, size, firstOnly);
  if (triples.length > 0) return triples;
  const counts = lineCountSteps(board, size, firstOnly);
  if (counts.length > 0) return counts;
  return uniqueLineSteps(board, size, firstOnly);
}

/** The single next step, or null when the techniques are out of ideas (§8). */
export function findStep(board: readonly Mark[], size: Size): SolveStep | null {
  return findSteps(board, size, true)[0] ?? null;
}

export interface SolveResult {
  readonly board: readonly Mark[];
  /** Every cell determined — the puzzle needs no guessing and is unique (§5). */
  readonly solved: boolean;
  /**
   * The board cannot be finished: two techniques proved different digits for
   * one cell, or the filled result breaks a rule. Neither can happen on a
   * puzzle this generator shipped; it is the player's own marks that reach it.
   */
  readonly contradiction: boolean;
  /** Cells the techniques wrote — 0 when the board was already finished. */
  readonly proved: number;
}

/**
 * Runs the three techniques to a fixpoint (§5), starting from the given board
 * (the bare givens during generation, the player's board for a hint).
 *
 * Every step of a sweep is applied before the next sweep, not one at a time:
 * the techniques are sound, so a step found now is still true later, and
 * batching turns a solve from one sweep per cell into one sweep per round of
 * reasoning.
 */
export function solve(start: readonly Mark[], size: Size): SolveResult {
  const board: Mark[] = [...start];
  let proved = 0;

  for (;;) {
    const steps = findSteps(board, size);
    if (steps.length === 0) break;
    for (const step of steps) {
      const current = board[step.index] ?? EMPTY;
      if (current === step.value) continue;
      if (current !== EMPTY) return { board, solved: false, contradiction: true, proved };
      board[step.index] = step.value;
      proved++;
    }
  }

  const full = board.every((cell) => cell !== EMPTY);
  if (full && findViolations(board, size).any) {
    return { board, solved: false, contradiction: true, proved };
  }
  return { board, solved: full, contradiction: false, proved };
}

export type Hint =
  /** One cell the techniques prove, with the line that proves it (§8). */
  | { readonly kind: 'step'; readonly step: SolveStep }
  /** A line that already breaks a rule. Shown before any deduction (§8). */
  | { readonly kind: 'violation'; readonly line: Line };

/**
 * The teaching hint of §8: the next cell the techniques settle from the
 * player's own board — never a lookup into the hidden solution.
 *
 * A broken line outranks every cell, exactly as it does in Nonogram §7: once a
 * row or column breaks one of the three rules, a deduction elsewhere is built
 * on digits that are already wrong, so the honest hint is the break itself.
 * Null when neither is found, which only wrong-but-still-legal digits can
 * cause.
 */
export function findHint(board: readonly Mark[], size: Size): Hint | null {
  const violations = findViolations(board, size);
  if (violations.any) {
    for (let index = 0; index < size; index++) {
      if (violations.rows[index]) return { kind: 'violation', line: { axis: 'row', index } };
    }
    for (let index = 0; index < size; index++) {
      if (violations.cols[index]) return { kind: 'violation', line: { axis: 'col', index } };
    }
  }
  const step = findStep(board, size);
  return step === null ? null : { kind: 'step', step };
}

/** Whether the techniques alone finish this board — the gate of §6. */
export function isFullyDetermined(board: readonly Mark[], size: Size): boolean {
  if (board.length !== cellCount(size)) return false;
  return solve(board, size).solved;
}
