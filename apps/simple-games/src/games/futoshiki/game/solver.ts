/**
 * The human-technique solver — the "no guessing" guarantee of
 * docs/FUTOSHIKI_RULES.md §7.
 *
 * Five techniques, and nothing else. They are the ones a person uses, in the
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
 * The candidate masks are the working state, not a per-step recomputation: an
 * elimination is progress the next technique can build on, which is what makes
 * the sign propagate down a chain (see `inequalitySteps`).
 */
import { findViolations, tablesFor } from './engine';
import {
  EMPTY,
  allCandidates,
  bitOf,
  cellCount,
  digitsOf,
  hasBit,
  highestDigit,
  lowestDigit,
  popcount,
  soleDigit,
  type Constraint,
  type Digit,
  type Grid,
  type Line,
  type Size,
} from './types';

/**
 * The five techniques, cheapest first (§7). The names travel to the Hint,
 * which turns them into plain sentences — the UI never shows the name itself
 * (§6, docs/I18N_POLICY.md).
 */
export type Technique =
  'inequality' | 'naked-single' | 'hidden-single' | 'naked-pair' | 'hidden-pair';

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
  /** The line the deduction was read off; null for a naked single (§6). */
  readonly line: Line | null;
  /** Indices into the puzzle's sign list that justify it; empty for singles. */
  readonly constraints: readonly number[];
  /** The already-known cells that carry the proof — what a hint highlights. */
  readonly support: readonly number[];
}

/**
 * Candidates ruled out. Not a cell the player can fill yet, and shown as a
 * hint all the same: "this sign means this cell cannot be 4 or 5" is the
 * reasoning Futoshiki is made of, and a hint that only ever named finished
 * cells would skip the part worth teaching (§6, Sudoku §5 does the same).
 */
export interface EliminationStep {
  readonly kind: 'elimination';
  readonly technique: 'inequality' | 'naked-pair' | 'hidden-pair';
  readonly eliminations: readonly Elimination[];
  readonly line: Line | null;
  readonly constraints: readonly number[];
  readonly support: readonly number[];
}

export type SolveStep = PlacementStep | EliminationStep;

/** The ladder, cheapest first — the order `sweep` consults them in (§7). */
export const TECHNIQUES: readonly Technique[] = [
  'inequality',
  'naked-single',
  'hidden-single',
  'naked-pair',
  'hidden-pair',
];

/**
 * Reads since the last reset — the unit generation is budgeted in.
 *
 * One read is one thing a technique looks at: a sign, a cell, or a line.
 * Digging a puzzle is a few dozen full solves, and a solve is a stack of
 * sweeps over the signs, the cells and the lines, so the cost of both is the
 * number of reads. A stopwatch measures that work times whatever else the
 * machine happens to be doing, and under `pnpm test` that is six other vitest
 * forks. This counts the work itself, and a seed always produces the same
 * count on any machine, which is what makes the §8 budget assertable rather
 * than merely observable. The reasoning is Sudoku §7's, verbatim; so is the
 * rule that wall clock is printed and never asserted.
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

/** Grid plus candidate masks, mutated as techniques are applied. */
interface SolveState {
  readonly grid: number[];
  readonly candidates: number[];
}

/**
 * Candidate masks for every cell, or null when the grid already contradicts
 * itself — a digit repeated in a line, a sign whose two filled cells read the
 * wrong way, or a cell with no candidate left.
 *
 * Only the Latin rule is applied here. The signs are left to the technique
 * (§7, technique 1) so that every deduction they make is a step the Hint can
 * show; folding them in silently would make the strongest reasoning in the
 * game the one the player never sees explained.
 */
export function computeCandidates(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
): number[] | null {
  const cells = cellCount(size);
  if (grid.length !== cells) return null;
  const { peers } = tablesFor(size);
  const candidates = new Array<number>(cells).fill(allCandidates(size));

  for (let index = 0; index < cells; index++) {
    const value = grid[index]!;
    if (value === EMPTY) continue;
    if (value < 1 || value > size) return null;
    candidates[index] = bitOf(value);
    for (const peer of peers[index]!) if (grid[peer] === value) return null;
  }

  for (let index = 0; index < cells; index++) {
    if (grid[index] !== EMPTY) continue;
    let mask = allCandidates(size);
    for (const peer of peers[index]!) {
      const value = grid[peer]!;
      if (value !== EMPTY) mask &= ~bitOf(value);
    }
    if (mask === 0) return null;
    candidates[index] = mask;
  }

  for (const { less, greater } of constraints) {
    const low = grid[less] ?? EMPTY;
    const high = grid[greater] ?? EMPTY;
    if (low !== EMPTY && high !== EMPTY && low >= high) return null;
  }

  return candidates;
}

function createState(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
): SolveState | null {
  const candidates = computeCandidates(grid, size, constraints);
  return candidates === null ? null : { grid: [...grid], candidates };
}

/** Writes a digit and prunes its line peers. False when a peer runs dry. */
function applyPlacement(state: SolveState, size: Size, index: number, digit: Digit): boolean {
  state.grid[index] = digit;
  state.candidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  for (const peer of tablesFor(size).peers[index]!) {
    if (state.grid[peer] !== EMPTY) continue;
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

/** Digits 1..hi-1 as a mask — everything strictly below a bound. */
const below = (hi: number): number => (hi <= 1 ? 0 : (1 << (hi - 1)) - 1);

/** Digits 1..lo as a mask — everything up to and including a bound. */
const upTo = (lo: number): number => (1 << lo) - 1;

/**
 * Technique 1 — the sign (§7). `a < b` means `a` cannot hold anything the cell
 * on the greater side has already run out of, and `b` cannot hold anything at
 * or below the smallest digit left to `a`.
 *
 * That is the whole rule, and running it to a fixpoint is what produces the
 * chain: on `a < b < c` the third cell caps the second, the second caps the
 * first, and a chain of k signs has narrowed both ends by k. Keeping it
 * pairwise is deliberate — the chain arrives as k separate steps, and a hint
 * that explains one sign at a time teaches better than one that drops a
 * five-cell chain on the player (§6).
 */
function inequalitySteps(
  state: SolveState,
  constraints: readonly Constraint[],
  firstOnly: boolean,
): EliminationStep[] {
  const { grid, candidates } = state;
  const out: EliminationStep[] = [];

  for (let position = 0; position < constraints.length; position++) {
    reads++;
    const { less, greater } = constraints[position]!;
    const eliminations: Elimination[] = [];

    if (grid[less] === EMPTY) {
      const gone = candidates[less]! & ~below(highestDigit(candidates[greater]!));
      if (gone !== 0) eliminations.push({ index: less, digits: digitsOf(gone) });
    }
    if (grid[greater] === EMPTY) {
      const gone = candidates[greater]! & upTo(lowestDigit(candidates[less]!));
      if (gone !== 0) eliminations.push({ index: greater, digits: digitsOf(gone) });
    }
    if (eliminations.length === 0) continue;

    out.push({
      kind: 'elimination',
      technique: 'inequality',
      eliminations,
      line: null,
      constraints: [position],
      support: [less, greater],
    });
    if (firstOnly) return out;
  }
  return out;
}

/** Technique 2 — one digit left for this cell (§7). */
function nakedSingleSteps(state: SolveState, size: Size, firstOnly: boolean): PlacementStep[] {
  const out: PlacementStep[] = [];
  for (let index = 0; index < cellCount(size); index++) {
    reads++;
    if (state.grid[index] !== EMPTY) continue;
    const value = soleDigit(state.candidates[index]!);
    if (value === null) continue;
    out.push({
      kind: 'placement',
      technique: 'naked-single',
      index,
      value,
      line: null,
      constraints: [],
      support: [index],
    });
    if (firstOnly) return out;
  }
  return out;
}

/** Technique 3 — one cell left for this digit in a row or column (§7). */
function hiddenSingleSteps(state: SolveState, size: Size, firstOnly: boolean): PlacementStep[] {
  const { lines, lineCells } = tablesFor(size);
  const out: PlacementStep[] = [];

  for (let k = 0; k < lines.length; k++) {
    reads++;
    const indices = lineCells[k]!;
    for (let digit = 1 as Digit; digit <= size; digit = (digit + 1) as Digit) {
      // -1 is "nowhere yet"; a second candidate cell ends the search for this
      // digit, because a hidden single is precisely the case of exactly one.
      let home = -1;
      let settled = false;
      for (const index of indices) {
        if (state.grid[index] === digit) {
          settled = true;
          break;
        }
        if (state.grid[index] !== EMPTY || !hasBit(state.candidates[index]!, digit)) continue;
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
        line: lines[k]!,
        constraints: [],
        support: indices.filter((index) => index !== home),
      });
      if (firstOnly) return out;
    }
  }
  return out;
}

/**
 * Technique 4 — two cells of a line sharing the same two candidates (§7).
 * Between them they use both digits up, so nothing else in the line can.
 */
function nakedPairSteps(state: SolveState, size: Size, firstOnly: boolean): EliminationStep[] {
  const { lines, lineCells } = tablesFor(size);
  const out: EliminationStep[] = [];

  for (let k = 0; k < lines.length; k++) {
    reads++;
    const indices = lineCells[k]!;
    const pairs = indices.filter(
      (index) => state.grid[index] === EMPTY && popcount(state.candidates[index]!) === 2,
    );

    for (let a = 0; a < pairs.length; a++) {
      for (let b = a + 1; b < pairs.length; b++) {
        const mask = state.candidates[pairs[a]!]!;
        if (state.candidates[pairs[b]!] !== mask) continue;

        const eliminations: Elimination[] = [];
        for (const index of indices) {
          if (index === pairs[a] || index === pairs[b]) continue;
          if (state.grid[index] !== EMPTY) continue;
          const gone = state.candidates[index]! & mask;
          if (gone !== 0) eliminations.push({ index, digits: digitsOf(gone) });
        }
        if (eliminations.length === 0) continue;

        out.push({
          kind: 'elimination',
          technique: 'naked-pair',
          eliminations,
          line: lines[k]!,
          constraints: [],
          support: [pairs[a]!, pairs[b]!],
        });
        if (firstOnly) return out;
      }
    }
  }
  return out;
}

/**
 * Technique 5 — two digits of a line that fit in the same two cells only (§7).
 * Those two cells are then those two digits, whatever else they were open to.
 */
function hiddenPairSteps(state: SolveState, size: Size, firstOnly: boolean): EliminationStep[] {
  const { lines, lineCells } = tablesFor(size);
  const out: EliminationStep[] = [];

  for (let k = 0; k < lines.length; k++) {
    reads++;
    const indices = lineCells[k]!;
    const homes: number[] = [];
    for (let digit = 1; digit <= size; digit++) {
      let mask = 0;
      for (let slot = 0; slot < indices.length; slot++) {
        const index = indices[slot]!;
        if (state.grid[index] === digit) {
          mask = 0;
          break;
        }
        if (state.grid[index] === EMPTY && hasBit(state.candidates[index]!, digit)) {
          mask |= 1 << slot;
        }
      }
      homes.push(mask);
    }

    for (let first = 0; first < size; first++) {
      if (popcount(homes[first]!) !== 2) continue;
      for (let second = first + 1; second < size; second++) {
        if (homes[second] !== homes[first]) continue;

        const pair = bitOf(first + 1) | bitOf(second + 1);
        const cells = indices.filter((_, slot) => ((homes[first]! >> slot) & 1) !== 0);
        const eliminations: Elimination[] = [];
        for (const index of cells) {
          const gone = state.candidates[index]! & ~pair;
          if (gone !== 0) eliminations.push({ index, digits: digitsOf(gone) });
        }
        if (eliminations.length === 0) continue;

        out.push({
          kind: 'elimination',
          technique: 'hidden-pair',
          eliminations,
          line: lines[k]!,
          constraints: [],
          support: cells,
        });
        if (firstOnly) return out;
      }
    }
  }
  return out;
}

/**
 * Everything the techniques prove from this state in one sweep, cheapest
 * technique first. A more expensive technique is only consulted once the
 * cheaper ones have nothing left to say, which is both how a person plays and
 * why the work counter stays small.
 */
function sweep(
  state: SolveState,
  size: Size,
  constraints: readonly Constraint[],
  firstOnly: boolean,
): SolveStep[] {
  const signs = inequalitySteps(state, constraints, firstOnly);
  if (signs.length > 0) return signs;
  const naked = nakedSingleSteps(state, size, firstOnly);
  if (naked.length > 0) return naked;
  const hidden = hiddenSingleSteps(state, size, firstOnly);
  if (hidden.length > 0) return hidden;
  const nakedPairs = nakedPairSteps(state, size, firstOnly);
  if (nakedPairs.length > 0) return nakedPairs;
  return hiddenPairSteps(state, size, firstOnly);
}

/** Every step the techniques can prove from this grid right now. */
export function findSteps(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
  firstOnly = false,
): SolveStep[] {
  const state = createState(grid, size, constraints);
  return state === null ? [] : sweep(state, size, constraints, firstOnly);
}

/** The single next step, or null when the techniques are out of ideas (§6). */
export function findStep(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
): SolveStep | null {
  return findSteps(grid, size, constraints, true)[0] ?? null;
}

export interface SolveResult {
  readonly grid: readonly number[];
  /** Every cell determined — the puzzle needs no guessing and is unique (§7). */
  readonly solved: boolean;
  /**
   * The board cannot be finished: two techniques proved different digits for
   * one cell, a cell ran out of candidates, or the filled result breaks a
   * rule. None of that can happen on a puzzle this generator shipped; it is
   * the player's own entries that reach it.
   */
  readonly contradiction: boolean;
  /** Cells the techniques wrote — 0 when the grid was already full. */
  readonly proved: number;
  /**
   * The techniques this solve actually used, cheapest first. Sudoku §6's
   * honesty measurement lives on this: a tier may promise which techniques are
   * ALLOWED, never that one is required, and the only way to know how often
   * the expensive end of the ladder earns its place is to count it (§7).
   */
  readonly techniques: readonly Technique[];
}

/** Safety valve: a real 49-cell solve needs far fewer rounds than this. */
const MAX_ROUNDS = 2000;

/**
 * Runs the techniques to a fixpoint (§7), starting from the given grid (the
 * bare givens during generation, the player's board for a hint).
 *
 * Every step of a sweep is applied before the next sweep, not one at a time.
 * The techniques are sound and candidate sets only ever shrink, so a step
 * found now is still true after its neighbours in the same sweep have been
 * applied — and batching turns a solve from one full sweep per deduction into
 * one per round of reasoning.
 */
export function solve(grid: Grid, size: Size, constraints: readonly Constraint[]): SolveResult {
  const used = new Set<Technique>();
  const finish = (
    reached: readonly number[],
    outcome: { solved: boolean; contradiction: boolean },
    proved: number,
  ): SolveResult => ({
    grid: reached,
    solved: outcome.solved,
    contradiction: outcome.contradiction,
    proved,
    techniques: TECHNIQUES.filter((technique) => used.has(technique)),
  });

  const state = createState(grid, size, constraints);
  if (state === null) return finish([...grid], { solved: false, contradiction: true }, 0);
  const broken = { solved: false, contradiction: true };
  let proved = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const steps = sweep(state, size, constraints, false);
    if (steps.length === 0) break;

    for (const step of steps) {
      used.add(step.technique);
      if (step.kind === 'elimination') {
        if (!applyElimination(state, step)) return finish(state.grid, broken, proved);
        continue;
      }
      const current = state.grid[step.index]!;
      if (current === step.value) continue;
      if (current !== EMPTY || !applyPlacement(state, size, step.index, step.value)) {
        return finish(state.grid, broken, proved);
      }
      proved++;
    }
  }

  const full = state.grid.every((value) => value !== EMPTY);
  if (full && findViolations(state.grid, size, constraints).any) {
    return finish(state.grid, broken, proved);
  }
  return finish(state.grid, { solved: full, contradiction: false }, proved);
}

export type Hint =
  /** One deduction the techniques make, with what justifies it (§6). */
  | { readonly kind: 'step'; readonly step: SolveStep }
  /** Something the board already breaks. Shown before any deduction (§6). */
  | {
      readonly kind: 'violation';
      readonly line: Line | null;
      readonly constraints: readonly number[];
      readonly cells: readonly number[];
    };

/**
 * The teaching hint of §6: the next thing the techniques settle on the
 * player's own board — never a lookup into the hidden solution.
 *
 * A break comes first, as it does in Nonogram §7 — and here it is not even a
 * preference. Once a line repeats a digit or a sign points the wrong way, the
 * candidate sets the techniques start from are contradictory, so
 * `computeCandidates` refuses and there is no deduction to offer: the break is
 * the only thing left to say. A broken sign is reported before a repeated
 * digit because it is the harder one to see — a repeat is visible by reading
 * the row, while a sign lives in the gap between two cells and is exactly what
 * a player filling a row forgets (§13).
 *
 * Null when neither is found, which happens on a finished board and on one
 * where the player's legal-but-wrong digits have left some cell with no digit
 * available — wrong, but not yet against a rule.
 */
export function findHint(grid: Grid, size: Size, constraints: readonly Constraint[]): Hint | null {
  const violations = findViolations(grid, size, constraints);
  if (violations.any) {
    for (const position of violations.constraints) {
      const constraint = constraints[position]!;
      return {
        kind: 'violation',
        line: null,
        constraints: [position],
        cells: [constraint.less, constraint.greater],
      };
    }
    const { lines, lineCells } = tablesFor(size);
    for (let k = 0; k < lines.length; k++) {
      const cells = lineCells[k]!.filter((index) => violations.cells.has(index));
      if (cells.length > 0) {
        return { kind: 'violation', line: lines[k]!, constraints: [], cells };
      }
    }
  }
  const step = findStep(grid, size, constraints);
  return step === null ? null : { kind: 'step', step };
}

/** Whether the techniques alone finish this grid — the gate of §8. */
export function isFullyDetermined(
  grid: Grid,
  size: Size,
  constraints: readonly Constraint[],
): boolean {
  if (grid.length !== cellCount(size)) return false;
  return solve(grid, size, constraints).solved;
}
