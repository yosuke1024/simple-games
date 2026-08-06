/**
 * Core Sudoku types. See docs/SUDOKU_RULES.md — the single source of truth for
 * the rules these shapes serve.
 *
 * Candidate sets are 9-bit masks (bit 0 = digit 1). Masks keep the solver and
 * the grader allocation-free in their hot loops, which is what lets generation
 * stay inside the per-board budget of §7 on a low-end phone.
 */

export const SIZE = 9;
export const BOX = 3;
export const CELLS = 81;

/** 1..9. Zero is not a digit; an empty cell is represented by 0 in a Grid. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 81 values, row-major. 0 = empty. */
export type Grid = readonly number[];

/** 81 candidate masks, row-major. */
export type Candidates = readonly number[];

export const ALL_CANDIDATES = 0b111111111;

export const bitOf = (digit: number): number => 1 << (digit - 1);
export const hasBit = (mask: number, digit: number): boolean => (mask & bitOf(digit)) !== 0;

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m !== 0; m &= m - 1) n++;
  return n;
}

/** The digits in a mask, ascending. */
export function digitsOf(mask: number): Digit[] {
  const out: Digit[] = [];
  for (let d = 1; d <= SIZE; d++) if (hasBit(mask, d)) out.push(d as Digit);
  return out;
}

/** The single digit in a one-bit mask, or null. */
export function soleDigit(mask: number): Digit | null {
  return popcount(mask) === 1 ? ((31 - Math.clz32(mask) + 1) as Digit) : null;
}

export const rowOf = (index: number): number => Math.floor(index / SIZE);
export const colOf = (index: number): number => index % SIZE;
export const boxOf = (index: number): number =>
  Math.floor(rowOf(index) / BOX) * BOX + Math.floor(colOf(index) / BOX);
export const indexOf = (row: number, col: number): number => row * SIZE + col;

/** The nine cell indices of each unit, built once. */
function buildUnits(): {
  rows: readonly (readonly number[])[];
  cols: readonly (readonly number[])[];
  boxes: readonly (readonly number[])[];
} {
  const rows: number[][] = [];
  const cols: number[][] = [];
  const boxes: number[][] = [];
  for (let u = 0; u < SIZE; u++) {
    rows.push([]);
    cols.push([]);
    boxes.push([]);
  }
  for (let i = 0; i < CELLS; i++) {
    rows[rowOf(i)]!.push(i);
    cols[colOf(i)]!.push(i);
    boxes[boxOf(i)]!.push(i);
  }
  return { rows, cols, boxes };
}

const UNITS = buildUnits();
export const ROWS = UNITS.rows;
export const COLS = UNITS.cols;
export const BOXES = UNITS.boxes;

export type UnitKind = 'row' | 'col' | 'box';

export interface Unit {
  readonly kind: UnitKind;
  /** 0..8 — which row, column, or box. */
  readonly index: number;
  readonly cells: readonly number[];
}

/** All 27 units, rows first — the order the grader scans them in. */
export const ALL_UNITS: readonly Unit[] = [
  ...ROWS.map((cells, index) => ({ kind: 'row' as const, index, cells })),
  ...COLS.map((cells, index) => ({ kind: 'col' as const, index, cells })),
  ...BOXES.map((cells, index) => ({ kind: 'box' as const, index, cells })),
];

/** Cells sharing a row, column, or box with the given cell (20 of them). */
function buildPeers(): readonly (readonly number[])[] {
  const peers: number[][] = [];
  for (let i = 0; i < CELLS; i++) {
    const set = new Set<number>([...ROWS[rowOf(i)]!, ...COLS[colOf(i)]!, ...BOXES[boxOf(i)]!]);
    set.delete(i);
    peers.push([...set]);
  }
  return peers;
}

export const PEERS = buildPeers();

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** A generated puzzle: the clues shown and the one solution they admit. */
export interface Puzzle {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Clues, 0 for the cells the player fills. */
  readonly givens: Grid;
  readonly solution: Grid;
}

export type GameMode = 'level' | 'daily';
export type GameStatus = 'playing' | 'solved';
