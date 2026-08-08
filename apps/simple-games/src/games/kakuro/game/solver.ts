/**
 * The human-technique solver — the "no guessing" guarantee of
 * docs/KAKURO_RULES.md §7.
 *
 * Six techniques, and nothing else. They are the ones a person uses, in the
 * order a person reaches for them, and they are shared by all three callers
 * that must agree: the generator only ships a puzzle this solver finishes
 * (§8), `guarantee.test.ts` re-checks that on every level, and the Hint hands
 * the player the next step this solver would take (§6). One implementation
 * means the promise, the check and the help cannot drift apart — Sudoku §8
 * makes the same argument for its grader.
 *
 * Every technique is sound: it only ever writes a digit, or rules out a
 * candidate, that every legal completion of the board agrees on. So a board
 * this solver fills has exactly one solution, and no puzzle needs a guess.
 *
 * Everything here is built on one table. A run is `k` distinct digits from
 * 1..9 adding to `S`, so the legal contents of a run are a subset of {1..9},
 * and there are only 512 of those in the whole game — at every board size,
 * because the digits are always 1..9 (§3). Bucketing all 512 by (size, sum)
 * once turns "what can a 16-in-2 hold" into an array index, and every
 * technique below is a lookup into that table plus a mask operation. That is
 * why the work budget of §8 is affordable on a board with no givens at all.
 */
import { findViolations, peersOf } from './engine';
import {
  ALL_DIGITS,
  EMPTY,
  bitOf,
  digitsOf,
  hasBit,
  popcount,
  soleDigit,
  type Digit,
  type RunTable,
} from './types';

/**
 * The six techniques, cheapest first (§7). The names travel to the Hint, which
 * turns them into plain sentences — the UI never shows the name itself (§6,
 * docs/I18N_POLICY.md).
 */
export type Technique =
  | 'fixed-partition'
  | 'intersection'
  | 'naked-single'
  | 'hidden-single'
  | 'naked-pair'
  | 'sum-tightening';

/** The ladder, cheapest first — the order `sweep` consults them in (§7). */
export const TECHNIQUES: readonly Technique[] = [
  'fixed-partition',
  'intersection',
  'naked-single',
  'hidden-single',
  'naked-pair',
  'sum-tightening',
];

/** Candidates one cell loses. */
export interface Elimination {
  readonly index: number;
  readonly digits: readonly Digit[];
}

/** A cell whose digit is now settled — what a hint points the player at (§6). */
export interface PlacementStep {
  readonly kind: 'placement';
  readonly technique: 'naked-single' | 'hidden-single';
  readonly index: number;
  readonly value: Digit;
  /** Indices into `table.runs` that justify it — the Hint's material (§6). */
  readonly runs: readonly number[];
  /** The cells inside those runs that carry the proof, for the highlight. */
  readonly support: readonly number[];
}

/**
 * Candidates ruled out. Not a cell the player can fill yet, and shown as a
 * hint all the same: "this row is 16 across two cells, so it can only be 7 and
 * 9" is the reasoning Kakuro is made of, and a hint that only ever named
 * finished cells would skip the part worth teaching (§6; Sudoku §5 and
 * Futoshiki §6 do the same).
 */
export interface EliminationStep {
  readonly kind: 'elimination';
  readonly technique: 'fixed-partition' | 'intersection' | 'naked-pair' | 'sum-tightening';
  readonly eliminations: readonly Elimination[];
  readonly runs: readonly number[];
  readonly support: readonly number[];
}

export type SolveStep = PlacementStep | EliminationStep;

/**
 * Reads since the last reset — the unit generation is budgeted in.
 *
 * One read is one thing a technique looks at: a run or a cell. Building a
 * Kakuro is a stack of full solves (§8), and a solve is a stack of sweeps over
 * the runs and the cells, so the cost of both is the number of reads. A
 * stopwatch measures that work times whatever else the machine happens to be
 * doing, and under `pnpm test` that is six other vitest forks. This counts the
 * work itself, and a seed always produces the same count on any machine, which
 * is what makes the §8 budget assertable rather than merely observable. The
 * reasoning is Sudoku §7's, verbatim; so is the rule that wall clock is
 * printed and never asserted.
 *
 * Nothing at runtime reads it; it costs one integer increment per read.
 */
let reads = 0;

export const solverWork = {
  read: (): number => reads,
  reset: (): void => {
    reads = 0;
  },
};

/* ------------------------------------------------------------------ *
 * The partition table
 * ------------------------------------------------------------------ */

interface Partitions {
  /** Every subset of 1..9 of this size and sum, as 9-bit masks. */
  readonly masks: readonly number[];
  /** Their union: every digit that can appear at all. */
  readonly union: number;
}

const NO_PARTITIONS: Partitions = { masks: [], union: 0 };

/**
 * `table[k][s]` — every way to make `s` from `k` distinct digits of 1..9.
 *
 * Built once for the whole game by walking all 512 subsets of {1..9} and
 * bucketing each by its size and sum. Enumerating the subsets is cheaper and
 * far shorter than any recursive construction, and doing it eagerly at module
 * load rather than lazily per (k, s) means the table is a plain array read
 * with no cache check on the hot path — which matters, because `intersection`
 * consults it twice per empty cell per sweep.
 *
 * Indices outside the real ranges (k of 0, sums no subset reaches) exist and
 * hold an empty entry, so callers never range-check before reading.
 */
const PARTITIONS: readonly (readonly Partitions[])[] = (() => {
  const buckets: number[][][] = Array.from({ length: 10 }, () =>
    Array.from({ length: 46 }, () => []),
  );
  for (let mask = 0; mask < 1 << 9; mask++) {
    let size = 0;
    let sum = 0;
    for (let digit = 1; digit <= 9; digit++) {
      if (!hasBit(mask, digit)) continue;
      size++;
      sum += digit;
    }
    buckets[size]![sum]!.push(mask);
  }
  return buckets.map((bySum) =>
    bySum.map((masks) => ({
      masks,
      union: masks.reduce((all, mask) => all | mask, 0),
    })),
  );
})();

/** Every digit set of `size` cells adding to `sum`. Empty when there is none. */
export function partitionsFor(size: number, sum: number): Partitions {
  if (size < 0 || size > 9 || sum < 0 || sum > 45) return NO_PARTITIONS;
  return PARTITIONS[size]![sum]!;
}

/**
 * The digits a run of this length and sum can hold at all — the combination
 * table a Kakuro player keeps at their elbow, e.g. 16 in 2 is exactly {7,9}
 * and 7 in 3 is exactly {1,2,4}.
 */
export const runDigits = (size: number, sum: number): number => partitionsFor(size, sum).union;

/** True when the (sum, length) pair admits exactly one digit set (§7, ①). */
export const isFixedPartition = (size: number, sum: number): boolean =>
  partitionsFor(size, sum).masks.length === 1;

/* ------------------------------------------------------------------ *
 * Solve state
 * ------------------------------------------------------------------ */

/** Entries plus candidate masks, mutated as techniques are applied. */
interface SolveState {
  readonly entries: number[];
  readonly candidates: number[];
}

/** What one run looks like right now: what is in it, and what is left to do. */
interface RunState {
  /** The digits already written into this run. */
  readonly placed: number;
  /** The clue minus what is written: what the empty cells still have to make. */
  readonly remaining: number;
  readonly empty: readonly number[];
}

/**
 * Candidate masks for every cell, or null when the board already contradicts
 * itself — a digit repeated in a run, a run written past its clue, a full run
 * adding to the wrong number, or a cell with no candidate left.
 *
 * Only the no-repeat rule is applied here. Everything the clues say is left to
 * the techniques (§7) so that every deduction they make is a step the Hint can
 * show; folding the sums in silently would make the whole of Kakuro's
 * reasoning the part the player never sees explained.
 */
export function computeCandidates(entries: readonly number[], table: RunTable): number[] | null {
  const size = table.rowRun.length;
  if (entries.length !== size) return null;
  const candidates = new Array<number>(size).fill(0);

  for (let index = 0; index < size; index++) {
    const value = entries[index] ?? EMPTY;
    const white = table.rowRun[index]! >= 0;
    if (!white) {
      if (value !== EMPTY) return null;
      continue;
    }
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
  }

  for (const run of table.runs) {
    let placed = 0;
    let sum = 0;
    let filled = 0;
    for (const index of run.cells) {
      const value = entries[index]!;
      if (value === EMPTY) continue;
      if (hasBit(placed, value)) return null;
      placed |= bitOf(value);
      sum += value;
      filled++;
    }
    if (sum > run.sum) return null;
    if (filled === run.cells.length && sum !== run.sum) return null;
  }

  for (const index of table.white) {
    const value = entries[index]!;
    if (value !== EMPTY) {
      candidates[index] = bitOf(value);
      continue;
    }
    let mask = ALL_DIGITS;
    for (const peer of peersOf(table, index)) {
      const peerValue = entries[peer]!;
      if (peerValue !== EMPTY) mask &= ~bitOf(peerValue);
    }
    if (mask === 0) return null;
    candidates[index] = mask;
  }

  return candidates;
}

function createState(entries: readonly number[], table: RunTable): SolveState | null {
  const candidates = computeCandidates(entries, table);
  return candidates === null ? null : { entries: [...entries], candidates };
}

/**
 * Every run's current state, computed once per sweep. A sweep collects all its
 * steps before any of them is applied, so the state is constant while the six
 * techniques read it — which is what lets them share one pass over the runs
 * instead of each rebuilding the same numbers.
 */
function runStates(state: SolveState, table: RunTable): RunState[] {
  return table.runs.map((run) => {
    let placed = 0;
    let sum = 0;
    const empty: number[] = [];
    for (const index of run.cells) {
      const value = state.entries[index]!;
      if (value === EMPTY) empty.push(index);
      else {
        placed |= bitOf(value);
        sum += value;
      }
    }
    return { placed, remaining: run.sum - sum, empty };
  });
}

/**
 * The digits the empty cells of a run can still hold, read straight off the
 * table: every partition of what is left to make over how many cells are left,
 * skipping the ones that would reuse a digit already written.
 *
 * This is the reading `intersection` uses, and it is a pure function of the
 * clue and the digits on the board — no candidate sets involved, which is what
 * makes it the cheap rung.
 */
function staticAllowed(run: RunState): number {
  const { masks } = partitionsFor(run.empty.length, run.remaining);
  let allowed = 0;
  for (const mask of masks) {
    if ((mask & run.placed) !== 0) continue;
    allowed |= mask;
  }
  return allowed;
}

/**
 * The same reading, filtered by what the cells will actually accept.
 *
 * A partition is dropped when some digit in it has nowhere to go, or some
 * empty cell can take nothing from it. Both are necessary conditions for the
 * partition to be usable, so dropping on them never discards a partition that
 * was really available — the eliminations that follow stay sound. They are not
 * sufficient (a full matching would be), so this under-eliminates rather than
 * over-eliminates, which is the only direction a solver may err in.
 *
 * Returns the union of the survivors and their intersection: what can appear,
 * and what must (the second is what `hidden-single` is entitled to look for).
 */
function tightAllowed(
  state: SolveState,
  run: RunState,
): { readonly allowed: number; readonly required: number } {
  const { masks } = partitionsFor(run.empty.length, run.remaining);
  let allowed = 0;
  let required = ALL_DIGITS;
  let any = false;

  for (const mask of masks) {
    if ((mask & run.placed) !== 0) continue;
    let usable = true;
    for (const index of run.empty) {
      if ((state.candidates[index]! & mask) === 0) {
        usable = false;
        break;
      }
    }
    if (usable) {
      for (const digit of digitsOf(mask)) {
        let home = false;
        for (const index of run.empty) {
          if (hasBit(state.candidates[index]!, digit)) {
            home = true;
            break;
          }
        }
        if (!home) {
          usable = false;
          break;
        }
      }
    }
    if (!usable) continue;
    allowed |= mask;
    required &= mask;
    any = true;
  }

  return any ? { allowed, required } : { allowed: 0, required: 0 };
}

/* ------------------------------------------------------------------ *
 * The six techniques
 * ------------------------------------------------------------------ */

/**
 * Technique 1 — the fixed partition (§7, ①). A (sum, length) pair that admits
 * exactly one digit set: 16 in 2 is {7,9}, 6 in 3 is {1,2,3}, 45 in 9 is all
 * of them. Every empty cell of the run is then limited to that set, less
 * whatever the run already holds.
 *
 * Technique 2 subsumes this one — a single-partition run has a single union —
 * and it is asked first anyway, deliberately. It costs one table lookup with
 * no candidate scan, and it is the sentence the Hint most wants to say (§6):
 * naming the whole run as one famous combination teaches more than naming the
 * digits that happen to survive an intersection.
 */
function fixedPartitionSteps(
  state: SolveState,
  table: RunTable,
  states: readonly RunState[],
  firstOnly: boolean,
): EliminationStep[] {
  const out: EliminationStep[] = [];

  for (let position = 0; position < table.runs.length; position++) {
    reads++;
    const run = table.runs[position]!;
    if (!isFixedPartition(run.cells.length, run.sum)) continue;
    const here = states[position]!;
    if (here.empty.length === 0) continue;

    const allowed = partitionsFor(run.cells.length, run.sum).union & ~here.placed;
    const eliminations: Elimination[] = [];
    for (const index of here.empty) {
      const gone = state.candidates[index]! & ~allowed;
      if (gone !== 0) eliminations.push({ index, digits: digitsOf(gone) });
    }
    if (eliminations.length === 0) continue;

    out.push({
      kind: 'elimination',
      technique: 'fixed-partition',
      eliminations,
      runs: [position],
      support: run.cells.filter((index) => state.entries[index] !== EMPTY),
    });
    if (firstOnly) return out;
  }
  return out;
}

/**
 * Technique 2 — the intersection (§7, ②). A white cell sits on one horizontal
 * run and one vertical run, so it can only hold a digit both of them still
 * allow. Each side's list comes straight off the partition table.
 *
 * This is the technique that does most of the work, and the one that makes
 * Kakuro solvable with no givens at all: neither clue alone says much, and the
 * two together often leave one digit.
 */
function intersectionSteps(
  state: SolveState,
  table: RunTable,
  states: readonly RunState[],
  firstOnly: boolean,
): EliminationStep[] {
  const allowed = states.map((run) => staticAllowed(run));
  const out: EliminationStep[] = [];

  for (const index of table.white) {
    reads++;
    if (state.entries[index] !== EMPTY) continue;
    const row = table.rowRun[index]!;
    const col = table.colRun[index]!;
    const gone = state.candidates[index]! & ~(allowed[row]! & allowed[col]!);
    if (gone === 0) continue;

    const support = [...table.runs[row]!.cells, ...table.runs[col]!.cells].filter(
      (cell) => state.entries[cell] !== EMPTY,
    );
    out.push({
      kind: 'elimination',
      technique: 'intersection',
      eliminations: [{ index, digits: digitsOf(gone) }],
      runs: [row, col],
      support,
    });
    if (firstOnly) return out;
  }
  return out;
}

/** Technique 3 — one digit left for this cell (§7, ③). */
function nakedSingleSteps(state: SolveState, table: RunTable, firstOnly: boolean): PlacementStep[] {
  const out: PlacementStep[] = [];
  for (const index of table.white) {
    reads++;
    if (state.entries[index] !== EMPTY) continue;
    const value = soleDigit(state.candidates[index]!);
    if (value === null) continue;
    out.push({
      kind: 'placement',
      technique: 'naked-single',
      index,
      value,
      runs: [table.rowRun[index]!, table.colRun[index]!],
      support: [index],
    });
    if (firstOnly) return out;
  }
  return out;
}

/**
 * Technique 4 — one cell left for this digit in a run (§7, ③).
 *
 * Kakuro's version needs one step Sudoku's does not: a digit is not
 * automatically owed to a run. "This row must contain a 9" only holds when
 * every remaining way of making the clue uses one, which is exactly the
 * intersection of the surviving partitions. Once a digit is known to be owed,
 * the ordinary argument applies — if only one empty cell will take it, that is
 * where it goes.
 */
function hiddenSingleSteps(
  state: SolveState,
  table: RunTable,
  states: readonly RunState[],
  firstOnly: boolean,
): PlacementStep[] {
  const out: PlacementStep[] = [];

  for (let position = 0; position < table.runs.length; position++) {
    reads++;
    const here = states[position]!;
    if (here.empty.length === 0) continue;
    const { required } = tightAllowed(state, here);
    if (required === 0) continue;

    for (const digit of digitsOf(required)) {
      let home = -1;
      let settled = false;
      for (const index of here.empty) {
        if (!hasBit(state.candidates[index]!, digit)) continue;
        if (home !== -1) {
          settled = true;
          break;
        }
        home = index;
      }
      if (settled || home === -1) continue;

      out.push({
        kind: 'placement',
        technique: 'hidden-single',
        index: home,
        value: digit,
        runs: [position],
        support: table.runs[position]!.cells.filter((index) => index !== home),
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * Technique 5 — two cells of a run sharing the same two candidates (§7, ④).
 * Between them they use both digits up, so nothing else in the run can have
 * either — the no-repeat rule doing the work, with the sums standing aside.
 */
function nakedPairSteps(
  state: SolveState,
  table: RunTable,
  states: readonly RunState[],
  firstOnly: boolean,
): EliminationStep[] {
  const out: EliminationStep[] = [];

  for (let position = 0; position < table.runs.length; position++) {
    reads++;
    const pairs = states[position]!.empty.filter(
      (index) => popcount(state.candidates[index]!) === 2,
    );

    for (let a = 0; a < pairs.length; a++) {
      for (let b = a + 1; b < pairs.length; b++) {
        const mask = state.candidates[pairs[a]!]!;
        if (state.candidates[pairs[b]!] !== mask) continue;

        const eliminations: Elimination[] = [];
        for (const index of states[position]!.empty) {
          if (index === pairs[a] || index === pairs[b]) continue;
          const gone = state.candidates[index]! & mask;
          if (gone !== 0) eliminations.push({ index, digits: digitsOf(gone) });
        }
        if (eliminations.length === 0) continue;

        out.push({
          kind: 'elimination',
          technique: 'naked-pair',
          eliminations,
          runs: [position],
          support: [pairs[a]!, pairs[b]!],
        });
        if (firstOnly) return out;
      }
    }
  }
  return out;
}

/**
 * Technique 6 — partial-sum tightening (§7, ④). The same partition reading as
 * technique 2, with the partitions the cells refuse thrown away first.
 *
 * "This run needs 11 more across two cells, so it is 2+9, 3+8, 4+7 or 5+6 —
 * but the left cell can only be 2 or 3, so 4+7 and 5+6 are out and the right
 * cell is 8 or 9." That second half is what this rung adds over technique 2,
 * and it costs a scan of the run's candidates per partition, which is why it
 * sits at the bottom of the ladder.
 */
function sumTighteningSteps(
  state: SolveState,
  table: RunTable,
  states: readonly RunState[],
  firstOnly: boolean,
): EliminationStep[] {
  const out: EliminationStep[] = [];

  for (let position = 0; position < table.runs.length; position++) {
    reads++;
    const here = states[position]!;
    if (here.empty.length === 0) continue;
    const { allowed } = tightAllowed(state, here);

    const eliminations: Elimination[] = [];
    for (const index of here.empty) {
      const gone = state.candidates[index]! & ~allowed;
      if (gone !== 0) eliminations.push({ index, digits: digitsOf(gone) });
    }
    if (eliminations.length === 0) continue;

    out.push({
      kind: 'elimination',
      technique: 'sum-tightening',
      eliminations,
      runs: [position],
      support: table.runs[position]!.cells.filter((index) => state.entries[index] !== EMPTY),
    });
    if (firstOnly) return out;
  }
  return out;
}

/**
 * Everything the techniques prove from this state in one sweep, cheapest
 * technique first. A more expensive technique is only consulted once the
 * cheaper ones have nothing left to say, which is both how a person plays and
 * why the work counter stays small.
 */
function sweep(state: SolveState, table: RunTable, firstOnly: boolean): SolveStep[] {
  const states = runStates(state, table);

  const fixed = fixedPartitionSteps(state, table, states, firstOnly);
  if (fixed.length > 0) return fixed;
  const crossing = intersectionSteps(state, table, states, firstOnly);
  if (crossing.length > 0) return crossing;
  const naked = nakedSingleSteps(state, table, firstOnly);
  if (naked.length > 0) return naked;
  const hidden = hiddenSingleSteps(state, table, states, firstOnly);
  if (hidden.length > 0) return hidden;
  const pairs = nakedPairSteps(state, table, states, firstOnly);
  if (pairs.length > 0) return pairs;
  return sumTighteningSteps(state, table, states, firstOnly);
}

/** Writes a digit and prunes its run peers. False when a peer runs dry. */
function applyPlacement(state: SolveState, table: RunTable, index: number, digit: Digit): boolean {
  state.entries[index] = digit;
  state.candidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  for (const peer of peersOf(table, index)) {
    if (state.entries[peer] !== EMPTY) continue;
    const next = state.candidates[peer]! & remove;
    if (next === 0) return false;
    state.candidates[peer] = next;
  }
  return true;
}

/** Applies an elimination. False when it empties a cell (a contradiction). */
function applyElimination(state: SolveState, step: EliminationStep): boolean {
  for (const { index, digits } of step.eliminations) {
    for (const digit of digits) state.candidates[index] = state.candidates[index]! & ~bitOf(digit);
    if (state.candidates[index] === 0) return false;
  }
  return true;
}

/** Every step the techniques can prove from this board right now. */
export function findSteps(
  entries: readonly number[],
  table: RunTable,
  firstOnly = false,
): SolveStep[] {
  const state = createState(entries, table);
  return state === null ? [] : sweep(state, table, firstOnly);
}

/** The single next step, or null when the techniques are out of ideas (§6). */
export function findStep(entries: readonly number[], table: RunTable): SolveStep | null {
  return findSteps(entries, table, true)[0] ?? null;
}

export interface SolveResult {
  readonly entries: readonly number[];
  /** Every cell determined — the puzzle needs no guessing and is unique (§7). */
  readonly solved: boolean;
  /**
   * The board cannot be finished: two techniques proved different digits for
   * one cell, a cell ran out of candidates, or the filled result breaks a
   * rule. None of that can happen on a puzzle this generator shipped; it is
   * the player's own entries that reach it.
   */
  readonly contradiction: boolean;
  /** Cells the techniques wrote — 0 when the board was already full. */
  readonly proved: number;
  /**
   * The techniques this solve actually used, cheapest first. Sudoku §6's
   * honesty measurement lives on this: a tier may promise which techniques are
   * ALLOWED, never that one is required, and the only way to know how often
   * the expensive end of the ladder earns its place is to count it (§7).
   */
  readonly techniques: readonly Technique[];
}

/** Safety valve: a real 81-cell board needs far fewer rounds than this. */
const MAX_ROUNDS = 2000;

/**
 * Runs the techniques to a fixpoint (§7), starting from the given board (the
 * empty grid during generation, the player's own entries for a hint).
 *
 * Every step of a sweep is applied before the next sweep, not one at a time.
 * The techniques are sound and candidate sets only ever shrink, so a step
 * found now is still true after its neighbours in the same sweep have been
 * applied — and batching turns a solve from one full sweep per deduction into
 * one per round of reasoning.
 */
export function solve(entries: readonly number[], table: RunTable): SolveResult {
  const used = new Set<Technique>();
  const finish = (
    reached: readonly number[],
    outcome: { solved: boolean; contradiction: boolean },
    proved: number,
  ): SolveResult => ({
    entries: reached,
    solved: outcome.solved,
    contradiction: outcome.contradiction,
    proved,
    techniques: TECHNIQUES.filter((technique) => used.has(technique)),
  });

  const state = createState(entries, table);
  if (state === null) return finish([...entries], { solved: false, contradiction: true }, 0);
  const broken = { solved: false, contradiction: true };
  let proved = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const steps = sweep(state, table, false);
    if (steps.length === 0) break;

    for (const step of steps) {
      used.add(step.technique);
      if (step.kind === 'elimination') {
        if (!applyElimination(state, step)) return finish(state.entries, broken, proved);
        continue;
      }
      const current = state.entries[step.index]!;
      if (current === step.value) continue;
      if (current !== EMPTY || !applyPlacement(state, table, step.index, step.value)) {
        return finish(state.entries, broken, proved);
      }
      proved++;
    }
  }

  const full = table.white.every((index) => state.entries[index] !== EMPTY);
  if (full && findViolations(state.entries, table).any) {
    return finish(state.entries, broken, proved);
  }
  return finish(state.entries, { solved: full, contradiction: false }, proved);
}

export type Hint =
  /** One deduction the techniques make, with what justifies it (§6). */
  | { readonly kind: 'step'; readonly step: SolveStep }
  /** Something the board already breaks. Shown before any deduction (§6). */
  | {
      readonly kind: 'violation';
      readonly runs: readonly number[];
      readonly cells: readonly number[];
    };

/**
 * The teaching hint of §6: the next thing the techniques settle on the
 * player's own board — never a lookup into the hidden solution.
 *
 * A break comes first, as it does in Nonogram §7 — and here it is not even a
 * preference. Once a run repeats a digit or overshoots its clue, the candidate
 * sets the techniques start from are contradictory, so `computeCandidates`
 * refuses and there is no deduction to offer: the break is the only thing left
 * to say.
 *
 * Null when neither is found, which happens on a finished board and on one
 * where the player's legal-but-wrong digits have left some cell with no digit
 * available — wrong, but not yet against a rule.
 */
export function findHint(entries: readonly number[], table: RunTable): Hint | null {
  const violations = findViolations(entries, table);
  if (violations.any) {
    for (let position = 0; position < table.runs.length; position++) {
      if (!violations.runs.has(position)) continue;
      const cells = table.runs[position]!.cells.filter((index) => violations.cells.has(index));
      return { kind: 'violation', runs: [position], cells };
    }
  }
  const step = findStep(entries, table);
  return step === null ? null : { kind: 'step', step };
}

/** Whether the techniques alone finish this board — the gate of §8. */
export function isFullyDetermined(entries: readonly number[], table: RunTable): boolean {
  if (entries.length !== table.rowRun.length) return false;
  return solve(entries, table).solved;
}
