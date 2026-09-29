/**
 * The human-technique solver (docs/SUDOKU_6X6_RULES.md §8).
 *
 * It solves the way a person does: cheapest technique first, one step at a
 * time, with the candidate grid as working state — so an elimination is real
 * progress rather than something the next pass forgets. Three things come
 * out, and they share this one implementation of the six techniques (§8):
 * - `solvableWithin(givens, tier)` — the question digging asks after every
 *   removal (§7 step 2);
 * - `gradeTier(givens)` — the lowest tier whose techniques finish the board,
 *   which is its difficulty (§6, §7 step 3);
 * - `findStep(grid)` — the next step and the cells and unit that justify it,
 *   which is what Hint shows (§5).
 *
 * Only the six techniques of §8 exist here. X-Wing, Swordfish and chains are
 * deliberately absent: a board that would need one is never dug (§6).
 *
 * Every technique is sound — it only removes a candidate no solution can use —
 * so a board the grader fills completely has exactly the one solution it
 * found (§7).
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
  PEERS,
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
import { solverWork } from './work';

export type Technique =
  | 'nakedSingle'
  | 'hiddenSingle'
  | 'lockedCandidatesPointing'
  | 'lockedCandidatesClaiming'
  | 'nakedPair'
  | 'hiddenPair';

/** Which tier a technique belongs to (§6). */
export const TECHNIQUE_TIER: Record<Technique, Difficulty> = {
  nakedSingle: 'easy',
  hiddenSingle: 'easy',
  lockedCandidatesPointing: 'medium',
  lockedCandidatesClaiming: 'medium',
  nakedPair: 'hard',
  hiddenPair: 'hard',
};

export const TIER_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Safety valve: a 36-cell solve needs far fewer steps than this. */
const MAX_STEPS = 500;

export interface UnitRef {
  readonly kind: UnitKind;
  /** 0..5 — which row, column, or box. */
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
function placeDigit(state: SolveState, index: number, digit: Digit): boolean {
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

// ---------- reading a unit as bitmasks ----------

/** The 0-based index a one-bit mask stands for. */
const bitIndex = (bit: number): number => 31 - Math.clz32(bit);

/** Bits set in a six-bit mask, by table. */
const BIT_COUNT = ((): Uint8Array => {
  const counts = new Uint8Array(1 << SIZE);
  for (let mask = 1; mask < counts.length; mask++) counts[mask] = counts[mask >> 1]! + (mask & 1);
  return counts;
})();

/**
 * Seats of the unit `scanUnit` last read: one six-bit mask per digit (indexed
 * digit − 1) of the unit's empty cells that still admit it — what every
 * technique below means by "where the digit can go". Module scope because the
 * grader is synchronous and single threaded.
 */
const unitSeats = new Int32Array(SIZE);

function scanUnit(cells: readonly number[], grid: Grid, candidates: readonly number[]): void {
  solverWork.add(1);
  unitSeats.fill(0);
  for (let s = 0; s < SIZE; s++) {
    const cell = cells[s]!;
    if (grid[cell] !== 0) continue;
    const seat = 1 << s;
    for (let rest = candidates[cell]!; rest !== 0; rest &= rest - 1) {
      const digit = bitIndex(rest & -rest);
      unitSeats[digit] = unitSeats[digit]! | seat;
    }
  }
}

/** The cells a seat mask picks out, in seat order. */
function cellsFrom(cells: readonly number[], seats: number): number[] {
  const out: number[] = [];
  for (let rest = seats; rest !== 0; rest &= rest - 1) out.push(cells[bitIndex(rest & -rest)]!);
  return out;
}

function eliminationStep(
  technique: Technique,
  targets: readonly number[],
  digits: readonly Digit[],
  pattern: readonly number[],
  unit: Unit,
): EliminationStep {
  return {
    kind: 'elimination',
    technique,
    eliminations: targets.map((index) => ({ index, digits })),
    pattern,
    digits,
    unit: unitRef(unit),
  };
}

// ---------- easy: singles ----------

function findNakedSingle(grid: Grid, candidates: readonly number[]): Step | null {
  // One read of the whole board: counted as its six rows.
  solverWork.add(SIZE);
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const digit = soleDigit(candidates[i]!);
    if (digit !== null) return { kind: 'placement', technique: 'nakedSingle', index: i, digit };
  }
  return null;
}

function findHiddenSingle(grid: Grid, candidates: readonly number[]): Step | null {
  for (const unit of ALL_UNITS) {
    solverWork.add(1);
    // The digits the unit's empty cells offer once and more than once: the
    // difference is the digits down to a single seat.
    let once = 0;
    let twice = 0;
    let placed = 0;
    for (const cell of unit.cells) {
      const value = grid[cell]!;
      if (value !== 0) {
        placed |= bitOf(value);
        continue;
      }
      const mask = candidates[cell]!;
      twice |= once & mask;
      once |= mask;
    }
    for (let singles = once & ~twice & ~placed; singles !== 0; singles &= singles - 1) {
      const bit = singles & -singles;
      for (const index of unit.cells) {
        const mask = candidates[index]!;
        if (grid[index] !== 0 || (mask & bit) === 0) continue;
        // Naked singles are reported first, so this really is a hidden one.
        if ((mask & (mask - 1)) === 0) break;
        return {
          kind: 'placement',
          technique: 'hiddenSingle',
          index,
          digit: (bitIndex(bit) + 1) as Digit,
          unit: unitRef(unit),
        };
      }
    }
  }
  return null;
}

// ---------- medium: locked candidates ----------

/** Seats of a box (row-major, 2 rows × 3) that share a row. */
const BOX_ROW_SEATS = [0b000111, 0b111000];
/** Seats of a box that share a column. */
const BOX_COL_SEATS = [0b001001, 0b010010, 0b100100];
/** Seats of a row that fall in one box (two boxes of three across). */
const ROW_BOX_SEATS = [0b000111, 0b111000];
/** Seats of a column that fall in one box (three boxes of two down). */
const COL_BOX_SEATS = [0b000011, 0b001100, 0b110000];

const within = (seats: number, groups: readonly number[]): boolean =>
  groups.some((group) => (seats & ~group) === 0);

/** Empty cells among `cells`, outside `exclude`, that still admit `digit`. */
function targetsFor(
  cells: readonly number[],
  exclude: (cell: number) => boolean,
  digit: number,
  grid: Grid,
  candidates: readonly number[],
): number[] {
  const bit = bitOf(digit);
  const out: number[] = [];
  for (const cell of cells) {
    if (exclude(cell) || grid[cell] !== 0) continue;
    if ((candidates[cell]! & bit) !== 0) out.push(cell);
  }
  return out;
}

/**
 * Pointing: inside a box, a digit's seats all share one row or column, so the
 * rest of that line cannot hold it.
 */
function findPointing(grid: Grid, candidates: readonly number[]): Step | null {
  for (let b = 0; b < SIZE; b++) {
    const box = ALL_UNITS[SIZE * 2 + b]!;
    scanUnit(box.cells, grid, candidates);
    for (let d = 1; d <= SIZE; d++) {
      const seats = unitSeats[d - 1]!;
      if (BIT_COUNT[seats]! < 2) continue;
      const first = box.cells[bitIndex(seats & -seats)]!;
      let line: readonly number[] | null = null;
      if (within(seats, BOX_ROW_SEATS)) line = ROWS[rowOf(first)]!;
      else if (within(seats, BOX_COL_SEATS)) line = COLS[colOf(first)]!;
      if (line === null) continue;
      const targets = targetsFor(line, (cell) => boxOf(cell) === b, d, grid, candidates);
      if (targets.length === 0) continue;
      return eliminationStep(
        'lockedCandidatesPointing',
        targets,
        [d as Digit],
        cellsFrom(box.cells, seats),
        box,
      );
    }
  }
  return null;
}

/**
 * Claiming: inside a row or column, a digit's seats all share one box, so the
 * rest of that box cannot hold it.
 */
function findClaiming(grid: Grid, candidates: readonly number[]): Step | null {
  for (let l = 0; l < SIZE * 2; l++) {
    const line = ALL_UNITS[l]!;
    const alongRow = line.kind === 'row';
    scanUnit(line.cells, grid, candidates);
    for (let d = 1; d <= SIZE; d++) {
      const seats = unitSeats[d - 1]!;
      if (BIT_COUNT[seats]! < 2) continue;
      if (!within(seats, alongRow ? ROW_BOX_SEATS : COL_BOX_SEATS)) continue;
      const first = line.cells[bitIndex(seats & -seats)]!;
      const box = boxOf(first);
      const inLine = alongRow
        ? (cell: number) => rowOf(cell) === line.index
        : (cell: number) => colOf(cell) === line.index;
      const targets = targetsFor(BOXES[box]!, inLine, d, grid, candidates);
      if (targets.length === 0) continue;
      return eliminationStep(
        'lockedCandidatesClaiming',
        targets,
        [d as Digit],
        cellsFrom(line.cells, seats),
        line,
      );
    }
  }
  return null;
}

// ---------- hard: pairs ----------

/**
 * Naked pair: two cells of a unit hold the same two candidates and nothing
 * else, so no other cell of the unit can use those digits.
 */
function findNakedPair(grid: Grid, candidates: readonly number[]): Step | null {
  for (const unit of ALL_UNITS) {
    solverWork.add(1);
    const cells = unit.cells;
    for (let i = 0; i < SIZE; i++) {
      const a = cells[i]!;
      const pair = candidates[a]!;
      if (grid[a] !== 0 || BIT_COUNT[pair] !== 2) continue;
      for (let j = i + 1; j < SIZE; j++) {
        const b = cells[j]!;
        if (grid[b] !== 0 || candidates[b] !== pair) continue;
        const targets: number[] = [];
        for (const cell of cells) {
          if (cell === a || cell === b || grid[cell] !== 0) continue;
          if ((candidates[cell]! & pair) !== 0) targets.push(cell);
        }
        if (targets.length === 0) continue;
        return {
          kind: 'elimination',
          technique: 'nakedPair',
          eliminations: targets.map((index) => ({
            index,
            digits: digitsOf(candidates[index]! & pair),
          })),
          pattern: [a, b],
          digits: digitsOf(pair),
          unit: unitRef(unit),
        };
      }
    }
  }
  return null;
}

/**
 * Hidden pair: two digits of a unit can only go in the same two cells, so
 * those cells hold nothing else.
 */
function findHiddenPair(grid: Grid, candidates: readonly number[]): Step | null {
  for (const unit of ALL_UNITS) {
    scanUnit(unit.cells, grid, candidates);
    for (let x = 0; x < SIZE; x++) {
      const seats = unitSeats[x]!;
      if (BIT_COUNT[seats] !== 2) continue;
      for (let y = x + 1; y < SIZE; y++) {
        if (unitSeats[y] !== seats) continue;
        const group = (1 << x) | (1 << y);
        const pattern = cellsFrom(unit.cells, seats);
        const eliminations: { index: number; digits: Digit[] }[] = [];
        for (const cell of pattern) {
          const extra = candidates[cell]! & ~group;
          if (extra !== 0) eliminations.push({ index: cell, digits: digitsOf(extra) });
        }
        if (eliminations.length === 0) continue;
        return {
          kind: 'elimination',
          technique: 'hiddenPair',
          eliminations,
          pattern,
          digits: digitsOf(group),
          unit: unitRef(unit),
        };
      }
    }
  }
  return null;
}

export interface Finder {
  readonly technique: Technique;
  readonly tier: Difficulty;
  readonly find: (grid: Grid, candidates: readonly number[]) => Step | null;
}

/**
 * Techniques in the order a person reaches for them (§8), cheapest first.
 * Exported so the tests can hold each finder to soundness on its own.
 */
export const FINDERS: readonly Finder[] = [
  { technique: 'nakedSingle', tier: 'easy', find: findNakedSingle },
  { technique: 'hiddenSingle', tier: 'easy', find: findHiddenSingle },
  { technique: 'lockedCandidatesPointing', tier: 'medium', find: findPointing },
  { technique: 'lockedCandidatesClaiming', tier: 'medium', find: findClaiming },
  { technique: 'nakedPair', tier: 'hard', find: findNakedPair },
  { technique: 'hiddenPair', tier: 'hard', find: findHiddenPair },
];

function nextStep(state: SolveState, maxRank: number): Step | null {
  for (const finder of FINDERS) {
    if (TIER_RANK[finder.tier] > maxRank) break;
    const step = finder.find(state.grid, state.candidates);
    if (step !== null) return step;
  }
  return null;
}

/**
 * The cheapest step justifiable from the digits currently on the board — what
 * Hint shows (§5). Candidates are derived from placed digits only: a hint
 * never depends on the player's own notes, so its reason is always visible.
 */
export function findStep(grid: Grid): Step | null {
  const state = createState(grid);
  return state === null ? null : nextStep(state, TIER_RANK.hard);
}

interface Walk {
  readonly solved: boolean;
  readonly techniques: ReadonlySet<Technique>;
  readonly steps: number;
}

function walk(givens: Grid, maxRank: number): Walk {
  const techniques = new Set<Technique>();
  const state = createState(givens);
  if (state === null) return { solved: false, techniques, steps: 0 };

  let empty = 0;
  for (let i = 0; i < CELLS; i++) if (state.grid[i] === 0) empty++;

  let steps = 0;
  while (empty > 0) {
    if (steps >= MAX_STEPS) return { solved: false, techniques, steps };
    const step = nextStep(state, maxRank);
    if (step === null) return { solved: false, techniques, steps };
    techniques.add(step.technique);
    steps++;
    if (step.kind === 'placement') {
      if (!placeDigit(state, step.index, step.digit)) return { solved: false, techniques, steps };
      empty--;
    } else if (!eliminate(state, step)) {
      return { solved: false, techniques, steps };
    }
  }
  return { solved: true, techniques, steps };
}

/**
 * Whether the techniques up to `tier` finish the puzzle on their own — the
 * question digging asks after every removal (§7 step 2).
 */
export function solvableWithin(givens: Grid, tier: Difficulty): boolean {
  return walk(givens, TIER_RANK[tier]).solved;
}

/**
 * The lowest tier whose technique set finishes the board, or null when even
 * Hard's does not (§7 step 3). Asked tier by tier, exactly as §7 states it:
 * Easy's set alone, then Medium's, then Hard's.
 */
export function gradeTier(givens: Grid): Difficulty | null {
  if (solvableWithin(givens, 'easy')) return 'easy';
  if (solvableWithin(givens, 'medium')) return 'medium';
  if (solvableWithin(givens, 'hard')) return 'hard';
  return null;
}

export interface GradeResult {
  /** Whether the six techniques alone finish the puzzle (no guessing). */
  readonly solvable: boolean;
  /** The hardest tier any step of the cheapest-first walk used. */
  readonly difficulty: Difficulty;
  readonly techniques: readonly Technique[];
  readonly steps: number;
}

/**
 * Solves with every technique, cheapest first, and reports the hardest one it
 * actually used — for tests that want to see the path, not just the tier.
 */
export function grade(givens: Grid): GradeResult {
  const result = walk(givens, TIER_RANK.hard);
  let hardest: Difficulty = 'easy';
  for (const technique of result.techniques) {
    const tier = TECHNIQUE_TIER[technique];
    if (TIER_RANK[tier] > TIER_RANK[hardest]) hardest = tier;
  }
  return {
    solvable: result.solved,
    difficulty: hardest,
    techniques: [...result.techniques],
    steps: result.steps,
  };
}
