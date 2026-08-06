/**
 * The human-technique solver (docs/SUDOKU_RULES.md §8).
 *
 * It solves the way a person does: cheapest technique first, one step at a
 * time, with the candidate grid as working state — so an elimination is real
 * progress rather than something the next pass forgets. Two things come out:
 * - the hardest technique a puzzle needs, which IS its difficulty tier (§6);
 * - the next logical step, which is what Hint shows (§5).
 *
 * Every step names the cells and the unit that justify it, so a hint can point
 * at the reason instead of just filling in the answer. Technique names stay
 * internal — the UI paraphrases them (§5).
 */
import { computeCandidates } from './solver';
import {
  ALL_UNITS,
  bitOf,
  BOXES,
  boxOf,
  CELLS,
  colOf,
  COLS,
  digitsOf,
  hasBit,
  PEERS,
  popcount,
  rowOf,
  ROWS,
  SIZE,
  soleDigit,
  type Difficulty,
  type Digit,
  type Grid,
  type Unit,
  type UnitKind,
} from './types';

export type Technique =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'lockedCandidatesPointing'
  | 'lockedCandidatesClaiming'
  | 'nakedPair'
  | 'hiddenPair'
  | 'nakedTriple'
  | 'hiddenTriple'
  | 'xWing';

/** Which tier a technique belongs to (§6). */
export const TECHNIQUE_TIER: Record<Technique, Difficulty> = {
  nakedSingle: 'easy',
  hiddenSingle: 'easy',
  lockedCandidatesPointing: 'medium',
  lockedCandidatesClaiming: 'medium',
  nakedPair: 'hard',
  hiddenPair: 'hard',
  nakedTriple: 'hard',
  hiddenTriple: 'hard',
  xWing: 'hard',
};

const TIER_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Safety valve: a real 81-cell solve needs far fewer steps than this. */
const MAX_STEPS = 2000;

export interface UnitRef {
  readonly kind: UnitKind;
  /** 0..8 — which row, column, or box. */
  readonly index: number;
}

/** A cell whose value is now determined. */
export interface PlacementStep {
  readonly kind: 'placement';
  readonly technique: Technique;
  readonly index: number;
  readonly digit: Digit;
  /** The unit that justifies it (absent for a naked single: the cell alone does). */
  readonly unit?: UnitRef;
}

/** Candidates that can be ruled out, which unblocks a later placement. */
export interface EliminationStep {
  readonly kind: 'elimination';
  readonly technique: Technique;
  /** Cells losing candidates, and which digits they lose. */
  readonly eliminations: readonly { readonly index: number; readonly digits: readonly Digit[] }[];
  /** The cells forming the pattern — the reason. */
  readonly pattern: readonly number[];
  readonly digits: readonly Digit[];
  readonly unit?: UnitRef;
}

export type Step = PlacementStep | EliminationStep;

const unitRef = (unit: Unit): UnitRef => ({ kind: unit.kind, index: unit.index });

/** Grid plus candidate masks, mutated as techniques are applied. */
interface SolveState {
  readonly grid: number[];
  readonly candidates: number[];
}

function createState(givens: Grid): SolveState | null {
  const candidates = computeCandidates(givens);
  if (candidates === null) return null;
  return { grid: [...givens], candidates };
}

/** Places a digit and prunes peers. Returns false when a peer runs dry. */
function place(state: SolveState, index: number, digit: Digit): boolean {
  state.grid[index] = digit;
  state.candidates[index] = bitOf(digit);
  const remove = ~bitOf(digit);
  for (const peer of PEERS[index]!) {
    if (state.grid[peer] !== 0) continue;
    const next = state.candidates[peer]! & remove;
    if (next === 0) return false;
    state.candidates[peer] = next;
  }
  return true;
}

/** Applies an elimination. Returns false when it empties a cell (contradiction). */
function eliminate(state: SolveState, step: EliminationStep): boolean {
  for (const { index, digits } of step.eliminations) {
    for (const digit of digits) {
      state.candidates[index] = state.candidates[index]! & ~bitOf(digit);
    }
    if (state.candidates[index] === 0) return false;
  }
  return true;
}

// ---------- easy ----------

function findNakedSingle(grid: Grid, candidates: readonly number[]): Step | null {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const digit = soleDigit(candidates[i]!);
    if (digit !== null) {
      return { kind: 'placement', technique: 'nakedSingle', index: i, digit };
    }
  }
  return null;
}

function findHiddenSingle(grid: Grid, candidates: readonly number[]): Step | null {
  for (const unit of ALL_UNITS) {
    for (let d = 1; d <= SIZE; d++) {
      const bit = bitOf(d);
      let seat = -1;
      let count = 0;
      let alreadyPlaced = false;
      for (const cell of unit.cells) {
        if (grid[cell] === d) {
          alreadyPlaced = true;
          break;
        }
        if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) {
          seat = cell;
          count++;
        }
      }
      if (alreadyPlaced || count !== 1) continue;
      // Naked singles are reported first, so this really is a hidden one.
      if (popcount(candidates[seat]!) === 1) continue;
      return {
        kind: 'placement',
        technique: 'hiddenSingle',
        index: seat,
        digit: d as Digit,
        unit: unitRef(unit),
      };
    }
  }
  return null;
}

// ---------- medium: locked candidates ----------

/** Cells of a unit that still admit `digit`. */
function seatsFor(unit: Unit, grid: Grid, candidates: readonly number[], digit: number): number[] {
  const bit = bitOf(digit);
  const seats: number[] = [];
  for (const cell of unit.cells) {
    if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) seats.push(cell);
  }
  return seats;
}

function eliminationStep(
  technique: Technique,
  targets: readonly number[],
  digits: readonly Digit[],
  pattern: readonly number[],
  unit?: Unit,
): EliminationStep | null {
  if (targets.length === 0) return null;
  return {
    kind: 'elimination',
    technique,
    eliminations: targets.map((index) => ({ index, digits })),
    pattern,
    digits,
    ...(unit ? { unit: unitRef(unit) } : {}),
  };
}

/**
 * Pointing: inside a box, a digit's seats all share one row or column, so the
 * rest of that line cannot hold it.
 */
function findPointing(grid: Grid, candidates: readonly number[]): Step | null {
  for (let b = 0; b < SIZE; b++) {
    const box: Unit = { kind: 'box', index: b, cells: BOXES[b]! };
    for (let d = 1; d <= SIZE; d++) {
      const seats = seatsFor(box, grid, candidates, d);
      if (seats.length < 2) continue;
      const first = seats[0]!;
      const sameRow = seats.every((c) => rowOf(c) === rowOf(first));
      const sameCol = seats.every((c) => colOf(c) === colOf(first));
      if (!sameRow && !sameCol) continue;
      const line = sameRow ? ROWS[rowOf(first)]! : COLS[colOf(first)]!;
      const targets = line.filter(
        (c) => boxOf(c) !== b && grid[c] === 0 && hasBit(candidates[c]!, d),
      );
      const step = eliminationStep('lockedCandidatesPointing', targets, [d as Digit], seats, box);
      if (step) return step;
    }
  }
  return null;
}

/**
 * Claiming: inside a line, a digit's seats all share one box, so the rest of
 * that box cannot hold it.
 */
function findClaiming(grid: Grid, candidates: readonly number[]): Step | null {
  const lines: Unit[] = [
    ...ROWS.map((cells, index) => ({ kind: 'row' as const, index, cells })),
    ...COLS.map((cells, index) => ({ kind: 'col' as const, index, cells })),
  ];
  for (const line of lines) {
    for (let d = 1; d <= SIZE; d++) {
      const seats = seatsFor(line, grid, candidates, d);
      if (seats.length < 2) continue;
      const box = boxOf(seats[0]!);
      if (!seats.every((c) => boxOf(c) === box)) continue;
      const targets = BOXES[box]!.filter(
        (c) => !seats.includes(c) && grid[c] === 0 && hasBit(candidates[c]!, d),
      );
      const step = eliminationStep('lockedCandidatesClaiming', targets, [d as Digit], seats, line);
      if (step) return step;
    }
  }
  return null;
}

// ---------- naked / hidden subsets ----------

/** Every combination of `size` items. */
function combinations<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, acc: T[]): void => {
    if (acc.length === size) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]!);
      pick(i + 1, acc);
      acc.pop();
    }
  };
  pick(0, []);
  return out;
}

/**
 * Naked subset: `size` cells in a unit share exactly `size` candidates between
 * them, so no other cell in the unit can use those digits.
 */
function findNakedSubset(
  grid: Grid,
  candidates: readonly number[],
  size: 2 | 3,
  technique: Technique,
): Step | null {
  for (const unit of ALL_UNITS) {
    const open = unit.cells.filter((c) => grid[c] === 0 && popcount(candidates[c]!) >= 2);
    if (open.length <= size) continue;
    for (const group of combinations(open, size)) {
      let union = 0;
      for (const cell of group) union |= candidates[cell]!;
      if (popcount(union) !== size) continue;
      const targets = open.filter((c) => !group.includes(c) && (candidates[c]! & union) !== 0);
      const step = eliminationStep(technique, targets, digitsOf(union), group, unit);
      if (step) return step;
    }
  }
  return null;
}

/**
 * Hidden subset: `size` digits in a unit can only go in the same `size` cells,
 * so those cells hold nothing else.
 */
function findHiddenSubset(
  grid: Grid,
  candidates: readonly number[],
  size: 2 | 3,
  technique: Technique,
): Step | null {
  for (const unit of ALL_UNITS) {
    const open = unit.cells.filter((c) => grid[c] === 0);
    if (open.length <= size) continue;
    const digitSeats = new Map<Digit, number[]>();
    for (let d = 1; d <= SIZE; d++) {
      const seats = open.filter((c) => hasBit(candidates[c]!, d));
      if (seats.length >= 2 && seats.length <= size) digitSeats.set(d as Digit, seats);
    }
    const digitList = [...digitSeats.keys()];
    if (digitList.length < size) continue;
    for (const group of combinations(digitList, size)) {
      const seatSet = new Set<number>();
      for (const d of group) for (const c of digitSeats.get(d)!) seatSet.add(c);
      if (seatSet.size !== size) continue;
      let groupMask = 0;
      for (const d of group) groupMask |= bitOf(d);
      const eliminations: { index: number; digits: Digit[] }[] = [];
      for (const cell of seatSet) {
        const extra = candidates[cell]! & ~groupMask;
        if (extra !== 0) eliminations.push({ index: cell, digits: digitsOf(extra) });
      }
      if (eliminations.length === 0) continue;
      return {
        kind: 'elimination',
        technique,
        eliminations,
        pattern: [...seatSet],
        digits: group,
        unit: unitRef(unit),
      };
    }
  }
  return null;
}

// ---------- hard: X-Wing ----------

/**
 * X-Wing: a digit confined to the same two columns in two different rows (or
 * the transpose) forms a rectangle; the digit then leaves those columns
 * everywhere else.
 */
function findXWing(grid: Grid, candidates: readonly number[]): Step | null {
  for (const orientation of ['row', 'col'] as const) {
    const lines = orientation === 'row' ? ROWS : COLS;
    const crossOf = orientation === 'row' ? colOf : rowOf;
    const crossLines = orientation === 'row' ? COLS : ROWS;
    for (let d = 1; d <= SIZE; d++) {
      const bit = bitOf(d);
      const pairs: { cells: number[]; crosses: number[] }[] = [];
      for (let l = 0; l < SIZE; l++) {
        const cells = lines[l]!.filter((c) => grid[c] === 0 && (candidates[c]! & bit) !== 0);
        if (cells.length === 2) pairs.push({ cells, crosses: cells.map(crossOf) });
      }
      for (const combo of combinations(pairs, 2)) {
        const a = combo[0]!;
        const b = combo[1]!;
        if (a.crosses[0] !== b.crosses[0] || a.crosses[1] !== b.crosses[1]) continue;
        const pattern = [...a.cells, ...b.cells];
        const targets: number[] = [];
        for (const cross of a.crosses) {
          for (const cell of crossLines[cross!]!) {
            if (pattern.includes(cell)) continue;
            if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) targets.push(cell);
          }
        }
        const step = eliminationStep('xWing', targets, [d as Digit], pattern);
        if (step) return step;
      }
    }
  }
  return null;
}

interface Finder {
  readonly tier: Difficulty;
  readonly find: (grid: Grid, candidates: readonly number[]) => Step | null;
}

/** Techniques in the order a person reaches for them (§8), cheapest first. */
const FINDERS: readonly Finder[] = [
  { tier: 'easy', find: findNakedSingle },
  { tier: 'easy', find: findHiddenSingle },
  { tier: 'medium', find: findPointing },
  { tier: 'medium', find: findClaiming },
  { tier: 'hard', find: (g, c) => findNakedSubset(g, c, 2, 'nakedPair') },
  { tier: 'hard', find: (g, c) => findHiddenSubset(g, c, 2, 'hiddenPair') },
  { tier: 'hard', find: (g, c) => findNakedSubset(g, c, 3, 'nakedTriple') },
  { tier: 'hard', find: (g, c) => findHiddenSubset(g, c, 3, 'hiddenTriple') },
  { tier: 'hard', find: findXWing },
];

function nextStep(state: SolveState, maxRank: number): Step | null {
  for (const finder of FINDERS) {
    if (TIER_RANK[finder.tier] > maxRank) continue;
    const step = finder.find(state.grid, state.candidates);
    if (step !== null) return step;
  }
  return null;
}

/**
 * The cheapest step justifiable from the digits currently on the board — what
 * Hint shows. Candidates are derived from placed digits only: a hint never
 * depends on the player's own pencil marks, so its reason is always visible.
 */
export function findStep(grid: Grid): Step | null {
  const state = createState(grid);
  return state === null ? null : nextStep(state, TIER_RANK.hard);
}

/**
 * Whether the techniques up to `tier` finish the puzzle on their own. Cheaper
 * than a full grade because it stops looking at harder techniques, and it is
 * exactly the question digging asks after every removal: "is this still a
 * puzzle of the tier I was asked for?" (docs/SUDOKU_RULES.md §7).
 */
export function solvableWithin(givens: Grid, tier: Difficulty): boolean {
  const state = createState(givens);
  if (state === null) return false;
  const maxRank = TIER_RANK[tier];

  let empty = 0;
  for (let i = 0; i < CELLS; i++) if (state.grid[i] === 0) empty++;

  for (let steps = 0; empty > 0; steps++) {
    if (steps >= MAX_STEPS) return false;
    const step = nextStep(state, maxRank);
    if (step === null) return false;
    if (step.kind === 'placement') {
      if (!place(state, step.index, step.digit)) return false;
      empty--;
    } else if (!eliminate(state, step)) {
      return false;
    }
  }
  return true;
}

export interface GradeResult {
  /** Whether the supported techniques alone finish the puzzle (no guessing). */
  readonly solvable: boolean;
  /** The hardest tier any step needed — the puzzle's difficulty. */
  readonly difficulty: Difficulty;
  readonly techniques: readonly Technique[];
  readonly steps: number;
}

/**
 * Solves logically and reports the hardest technique required. `solvable:
 * false` means the puzzle needs something beyond §6, and generation discards
 * it — that is what guarantees every shipped board is solvable without
 * guessing.
 */
export function grade(givens: Grid): GradeResult {
  const state = createState(givens);
  const used = new Set<Technique>();
  let hardest: Difficulty = 'easy';
  let steps = 0;

  const result = (solvable: boolean): GradeResult => ({
    solvable,
    difficulty: hardest,
    techniques: [...used],
    steps,
  });

  if (state === null) return result(false);

  let empty = 0;
  for (let i = 0; i < CELLS; i++) if (state.grid[i] === 0) empty++;

  while (empty > 0) {
    if (steps >= MAX_STEPS) return result(false);
    const step = nextStep(state, TIER_RANK.hard);
    if (step === null) return result(false);

    used.add(step.technique);
    const tier = TECHNIQUE_TIER[step.technique];
    if (TIER_RANK[tier] > TIER_RANK[hardest]) hardest = tier;
    steps++;

    if (step.kind === 'placement') {
      if (!place(state, step.index, step.digit)) return result(false);
      empty--;
    } else if (!eliminate(state, step)) {
      return result(false);
    }
  }

  return result(true);
}
