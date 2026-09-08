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
 *
 * The finders read a unit as bitmasks over its nine seats and allocate only
 * once they have a step to return. Digging asks `solvableWithin` after every
 * removal probe (§7), and most probes land on a board that goes nowhere and so
 * pays for all nine scans — so a scan that finds nothing is what generation
 * actually spends its budget on.
 */
import { computeCandidates } from './solver';
import {
  ALL_UNITS,
  bitOf,
  BOX,
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

// ---------- reading a unit as bitmasks ----------

/** Where boxes begin in ALL_UNITS, which runs rows, then columns, then boxes. */
const FIRST_BOX_UNIT = SIZE * 2;

/** The 0-based index a one-bit mask stands for: a digit minus one, or a seat. */
const bitIndex = (bit: number): number => 31 - Math.clz32(bit);

/**
 * Bits set in a nine-bit mask. Every scan below counts bits in its innermost
 * loop — a triple asks it of eighty-four unions per unit — so the count is a
 * table lookup rather than a loop over the bits.
 */
const BIT_COUNT = ((): Uint8Array => {
  const counts = new Uint8Array(1 << SIZE);
  for (let mask = 1; mask < counts.length; mask++) counts[mask] = counts[mask >> 1]! + (mask & 1);
  return counts;
})();

/** The cells a seat mask picks out, in seat order. */
function cellsFrom(cells: readonly number[], seats: number): number[] {
  const out: number[] = [];
  for (let rest = seats; rest !== 0; rest &= rest - 1) out.push(cells[bitIndex(rest & -rest)]!);
  return out;
}

/**
 * Seats of the unit `scanUnit` last read: one 9-bit mask per digit (indexed
 * digit − 1), plus the mask of its empty seats. A seat is an empty cell that
 * still admits the digit, which is what every technique below means by "where
 * the digit can go".
 */
const unitSeats = new Int32Array(SIZE);
let unitOpen = 0;

/**
 * Reads one unit into the masks above. They live at module scope because the
 * grader is synchronous and single threaded, and the alternative is an array
 * per unit per scan — paid on every scan, including the ones that find nothing.
 */
function scanUnit(cells: readonly number[], grid: Grid, candidates: readonly number[]): void {
  unitSeats.fill(0);
  unitOpen = 0;
  for (let s = 0; s < SIZE; s++) {
    const cell = cells[s]!;
    if (grid[cell] !== 0) continue;
    const seat = 1 << s;
    unitOpen |= seat;
    for (let rest = candidates[cell]!; rest !== 0; rest &= rest - 1) {
      const digit = bitIndex(rest & -rest);
      unitSeats[digit] = unitSeats[digit]! | seat;
    }
  }
}

// ---------- easy ----------

function findNakedSingle(grid: Grid, candidates: readonly number[]): Step | null {
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const mask = candidates[i]!;
    // Ruling a cell out with one test beats counting its bits, and this scan
    // visits every empty cell before any other technique is even considered.
    if (mask === 0 || (mask & (mask - 1)) !== 0) continue;
    const digit = soleDigit(mask);
    if (digit !== null) {
      return { kind: 'placement', technique: 'nakedSingle', index: i, digit };
    }
  }
  return null;
}

function findHiddenSingle(grid: Grid, candidates: readonly number[]): Step | null {
  for (const unit of ALL_UNITS) {
    // Which digits the unit's empty cells offer at all, and which they offer
    // more than once: the difference is the digits down to a single seat. Seat
    // masks would answer the same question, but this runs on every step.
    let once = 0;
    let twice = 0;
    let placed = 0;
    for (let s = 0; s < SIZE; s++) {
      const cell = unit.cells[s]!;
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
      for (let s = 0; s < SIZE; s++) {
        const index = unit.cells[s]!;
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

/** Seats of a unit taken three at a time: a box's rows, or a box's span of a line. */
const TRIPLE_SEATS = [0b000000111, 0b000111000, 0b111000000];
/** Seats of a box that share a column. */
const BOX_COLUMN_SEATS = [0b001001001, 0b010010010, 0b100100100];

/** Which of `groups` holds every seat, or -1 when they straddle more than one. */
function seatGroup(seats: number, groups: readonly number[]): number {
  for (let g = 0; g < BOX; g++) if ((seats & ~groups[g]!) === 0) return g;
  return -1;
}

function eliminationStep(
  technique: Technique,
  targets: readonly number[],
  digits: readonly Digit[],
  pattern: readonly number[],
  unit?: Unit,
): EliminationStep {
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
    const box = ALL_UNITS[FIRST_BOX_UNIT + b]!;
    scanUnit(box.cells, grid, candidates);
    for (let d = 1; d <= SIZE; d++) {
      const seats = unitSeats[d - 1]!;
      if ((seats & (seats - 1)) === 0) continue;
      const alongRow = seatGroup(seats, TRIPLE_SEATS) >= 0;
      if (!alongRow && seatGroup(seats, BOX_COLUMN_SEATS) < 0) continue;
      const first = box.cells[bitIndex(seats & -seats)]!;
      const line = alongRow ? ROWS[rowOf(first)]! : COLS[colOf(first)]!;
      // The box owns three consecutive seats of that line; the rest are targets.
      const span = TRIPLE_SEATS[alongRow ? b % BOX : Math.floor(b / BOX)]!;
      const bit = bitOf(d);
      let targets = 0;
      for (let s = 0; s < SIZE; s++) {
        if ((span & (1 << s)) !== 0) continue;
        const cell = line[s]!;
        if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) targets |= 1 << s;
      }
      if (targets === 0) continue;
      return eliminationStep(
        'lockedCandidatesPointing',
        cellsFrom(line, targets),
        [d as Digit],
        cellsFrom(box.cells, seats),
        box,
      );
    }
  }
  return null;
}

/**
 * Claiming: inside a line, a digit's seats all share one box, so the rest of
 * that box cannot hold it.
 */
function findClaiming(grid: Grid, candidates: readonly number[]): Step | null {
  for (let l = 0; l < FIRST_BOX_UNIT; l++) {
    const line = ALL_UNITS[l]!;
    const alongRow = l < SIZE;
    scanUnit(line.cells, grid, candidates);
    for (let d = 1; d <= SIZE; d++) {
      const seats = unitSeats[d - 1]!;
      if ((seats & (seats - 1)) === 0) continue;
      const third = seatGroup(seats, TRIPLE_SEATS);
      if (third < 0) continue;
      const box = ALL_UNITS[FIRST_BOX_UNIT + boxOf(line.cells[third * BOX]!)]!;
      // The line owns three seats of that box; only the other six can lose the digit.
      const shared = (alongRow ? TRIPLE_SEATS : BOX_COLUMN_SEATS)[l % BOX]!;
      const bit = bitOf(d);
      let targets = 0;
      for (let s = 0; s < SIZE; s++) {
        if ((shared & (1 << s)) !== 0) continue;
        const cell = box.cells[s]!;
        if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) targets |= 1 << s;
      }
      if (targets === 0) continue;
      return eliminationStep(
        'lockedCandidatesClaiming',
        cellsFrom(box.cells, targets),
        [d as Digit],
        cellsFrom(line.cells, seats),
        line,
      );
    }
  }
  return null;
}

// ---------- naked / hidden subsets ----------

/** Cells of a unit that can join a naked subset, in unit order, and their masks. */
const openCells = new Array<number>(SIZE).fill(0);
const openMasks = new Array<number>(SIZE).fill(0);

/** The step a matched naked subset yields, or null when it rules nothing out. */
function nakedSubsetStep(
  technique: Technique,
  unit: Unit,
  open: number,
  group: number,
  union: number,
): EliminationStep | null {
  let targets = 0;
  for (let t = 0; t < open; t++) {
    if ((group & (1 << t)) !== 0) continue;
    if ((openMasks[t]! & union) !== 0) targets |= 1 << t;
  }
  if (targets === 0) return null;
  return eliminationStep(
    technique,
    cellsFrom(openCells, targets),
    digitsOf(union),
    cellsFrom(openCells, group),
    unit,
  );
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
    let open = 0;
    for (let s = 0; s < SIZE; s++) {
      const cell = unit.cells[s]!;
      if (grid[cell] !== 0) continue;
      const mask = candidates[cell]!;
      if ((mask & (mask - 1)) === 0) continue;
      openCells[open] = cell;
      openMasks[open] = mask;
      open++;
    }
    if (open <= size) continue;
    for (let i = 0; i < open; i++) {
      const first = openMasks[i]!;
      // A union only grows, so a prefix already too wide can never be a subset.
      if (BIT_COUNT[first]! > size) continue;
      for (let j = i + 1; j < open; j++) {
        const pair = first | openMasks[j]!;
        if (BIT_COUNT[pair]! > size) continue;
        if (size === 2) {
          const step = nakedSubsetStep(technique, unit, open, (1 << i) | (1 << j), pair);
          if (step !== null) return step;
          continue;
        }
        for (let k = j + 1; k < open; k++) {
          const union = pair | openMasks[k]!;
          if (BIT_COUNT[union]! !== size) continue;
          const step = nakedSubsetStep(
            technique,
            unit,
            open,
            (1 << i) | (1 << j) | (1 << k),
            union,
          );
          if (step !== null) return step;
        }
      }
    }
  }
  return null;
}

/** Digits of the scanned unit that can join a hidden subset, ascending. */
const subsetDigits = new Int32Array(SIZE);

/** The step a matched hidden subset yields, or null when it rules nothing out. */
function hiddenSubsetStep(
  technique: Technique,
  unit: Unit,
  candidates: readonly number[],
  group: number,
  union: number,
): EliminationStep | null {
  // A subset whose cells hold nothing but the group is true but says nothing,
  // and asking first is what keeps the arrays below off the failing path.
  let eliminates = false;
  for (let rest = union; rest !== 0 && !eliminates; rest &= rest - 1) {
    const cell = unit.cells[bitIndex(rest & -rest)]!;
    eliminates = (candidates[cell]! & ~group) !== 0;
  }
  if (!eliminates) return null;
  // The pattern follows the digits into their seats — each digit in turn, its
  // seats in unit order — so a cell is named where its first digit reaches it.
  const pattern: number[] = [];
  let seen = 0;
  for (let digits = group; digits !== 0; digits &= digits - 1) {
    for (let rest = unitSeats[bitIndex(digits & -digits)]!; rest !== 0; rest &= rest - 1) {
      const seat = rest & -rest;
      if ((seen & seat) !== 0) continue;
      seen |= seat;
      pattern.push(unit.cells[bitIndex(seat)]!);
    }
  }
  const eliminations: { index: number; digits: Digit[] }[] = [];
  for (const cell of pattern) {
    const extra = candidates[cell]! & ~group;
    if (extra !== 0) eliminations.push({ index: cell, digits: digitsOf(extra) });
  }
  return {
    kind: 'elimination',
    technique,
    eliminations,
    pattern,
    digits: digitsOf(group),
    unit: unitRef(unit),
  };
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
    scanUnit(unit.cells, grid, candidates);
    if (BIT_COUNT[unitOpen]! <= size) continue;
    let count = 0;
    for (let d = 0; d < SIZE; d++) {
      const seats = BIT_COUNT[unitSeats[d]!]!;
      if (seats >= 2 && seats <= size) {
        subsetDigits[count] = d;
        count++;
      }
    }
    if (count < size) continue;
    for (let i = 0; i < count; i++) {
      const first = subsetDigits[i]!;
      for (let j = i + 1; j < count; j++) {
        const second = subsetDigits[j]!;
        const pair = unitSeats[first]! | unitSeats[second]!;
        // A union only grows, so a prefix already too wide can never be a subset.
        if (BIT_COUNT[pair]! > size) continue;
        if (size === 2) {
          const group = (1 << first) | (1 << second);
          const step = hiddenSubsetStep(technique, unit, candidates, group, pair);
          if (step !== null) return step;
          continue;
        }
        for (let k = j + 1; k < count; k++) {
          const third = subsetDigits[k]!;
          const union = pair | unitSeats[third]!;
          if (BIT_COUNT[union]! !== size) continue;
          const group = (1 << first) | (1 << second) | (1 << third);
          const step = hiddenSubsetStep(technique, unit, candidates, group, union);
          if (step !== null) return step;
        }
      }
    }
  }
  return null;
}

// ---------- hard: X-Wing ----------

/** Seats per line of the orientation being scanned, indexed line * SIZE + digit − 1. */
const lineSeats = new Int32Array(SIZE * SIZE);
/** The lines where a digit has exactly two seats — the only ones that can pair up. */
const pairLines = new Int32Array(SIZE);
const pairSeats = new Int32Array(SIZE);

/**
 * X-Wing: a digit confined to the same two columns in two different rows (or
 * the transpose) forms a rectangle; the digit then leaves those columns
 * everywhere else.
 */
function findXWing(grid: Grid, candidates: readonly number[]): Step | null {
  for (let orientation = 0; orientation < 2; orientation++) {
    const lines = orientation === 0 ? ROWS : COLS;
    const crossLines = orientation === 0 ? COLS : ROWS;
    for (let l = 0; l < SIZE; l++) {
      scanUnit(lines[l]!, grid, candidates);
      for (let d = 0; d < SIZE; d++) lineSeats[l * SIZE + d] = unitSeats[d]!;
    }
    for (let d = 1; d <= SIZE; d++) {
      let pairs = 0;
      for (let l = 0; l < SIZE; l++) {
        const seats = lineSeats[l * SIZE + d - 1]!;
        if (BIT_COUNT[seats]! !== 2) continue;
        pairLines[pairs] = l;
        pairSeats[pairs] = seats;
        pairs++;
      }
      const bit = bitOf(d);
      for (let i = 0; i < pairs; i++) {
        for (let j = i + 1; j < pairs; j++) {
          const seats = pairSeats[i]!;
          if (seats !== pairSeats[j]!) continue;
          const near = pairLines[i]!;
          const far = pairLines[j]!;
          const left = bitIndex(seats & -seats);
          const right = bitIndex(seats & (seats - 1));
          // The two cross lines lose the digit everywhere off the rectangle.
          let targets = 0;
          for (let c = 0; c < 2; c++) {
            const cross = crossLines[c === 0 ? left : right]!;
            for (let s = 0; s < SIZE; s++) {
              if (s === near || s === far) continue;
              const cell = cross[s]!;
              if (grid[cell] === 0 && (candidates[cell]! & bit) !== 0) {
                targets |= 1 << (c * SIZE + s);
              }
            }
          }
          if (targets === 0) continue;
          const eliminated: number[] = [];
          for (let rest = targets; rest !== 0; rest &= rest - 1) {
            const t = bitIndex(rest & -rest);
            eliminated.push(crossLines[t < SIZE ? left : right]![t % SIZE]!);
          }
          const pattern = [
            lines[near]![left]!,
            lines[near]![right]!,
            lines[far]![left]!,
            lines[far]![right]!,
          ];
          return eliminationStep('xWing', eliminated, [d as Digit], pattern);
        }
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

/**
 * Every technique scan the grader runs, counted since the last reset.
 *
 * This is the unit of work grading is made of: digging asks `solvableWithin`
 * after every removal probe, and each answer is a run of these scans — mostly
 * scans that find nothing, since a probe that goes nowhere pays for all nine.
 * A stopwatch measures that work times whatever else the machine happened to
 * be doing; this counts the work itself, and a seed always produces the same
 * count on any machine. It is the other half of `searchWork`: between them
 * they are what generation costs, which is what makes the §7 budget assertable
 * rather than merely observable — see `generator.test.ts`.
 *
 * Nothing at runtime reads it; it costs one integer increment per scan.
 */
let scans = 0;

export const logicWork = {
  read: (): number => scans,
  reset: (): void => {
    scans = 0;
  },
};

function nextStep(state: SolveState, maxRank: number): Step | null {
  for (const finder of FINDERS) {
    if (TIER_RANK[finder.tier] > maxRank) continue;
    scans++;
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
