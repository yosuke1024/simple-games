/**
 * Core Sudoku 6×6 types. See docs/SUDOKU_6X6_RULES.md — the single source of
 * truth for the rules these shapes serve.
 *
 * The board is 6×6 with six boxes of 2 rows × 3 columns (§1): boxes 0 and 1
 * sit side by side in rows 0–1, 2 and 3 in rows 2–3, 4 and 5 in rows 4–5.
 * Candidate sets are 6-bit masks (bit 0 = digit 1), which keeps the solver and
 * the grader allocation-free in their hot loops.
 *
 * Written for this game rather than shared with the 9×9 Sudoku: games never
 * import each other (docs/ARCHITECTURE.md), and the two boards are different
 * shapes all the way down.
 */

export const SIZE = 6;
export const BOX_ROWS = 2;
export const BOX_COLS = 3;
export const CELLS = SIZE * SIZE;

/** 1..6. Zero is not a digit; an empty cell is represented by 0 in a Grid. */
export type Digit = 1 | 2 | 3 | 4 | 5 | 6;

/** 36 values, row-major. 0 = empty. */
export type Grid = readonly number[];

export const ALL_CANDIDATES = 0b111111;

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
/** §1: box = floor(row / 2) * 2 + floor(col / 3). */
export const boxOf = (index: number): number =>
  Math.floor(rowOf(index) / BOX_ROWS) * (SIZE / BOX_COLS) + Math.floor(colOf(index) / BOX_COLS);
export const indexOf = (row: number, col: number): number => row * SIZE + col;

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
  /** 0..5 — which row, column, or box. */
  readonly index: number;
  readonly cells: readonly number[];
}

/** All 18 units, rows first — the order the grader scans them in. */
export const ALL_UNITS: readonly Unit[] = [
  ...ROWS.map((cells, index) => ({ kind: 'row' as const, index, cells })),
  ...COLS.map((cells, index) => ({ kind: 'col' as const, index, cells })),
  ...BOXES.map((cells, index) => ({ kind: 'box' as const, index, cells })),
];

/** Cells sharing a row, column, or box with the given cell (12 of them). */
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

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'medium' || value === 'hard';

/** A difficulty board or the daily (§9). There are no levels and no free play. */
export type GameMode = 'difficulty' | 'daily';
export type GameStatus = 'playing' | 'solved';
