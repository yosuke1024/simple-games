/**
 * Test-only helpers: hand-built boards from eight rows of digits, and a
 * readable dump. Not exported from index.ts.
 */
import { BOARD_SIZE, EMPTY, type Board } from './types';

/** Eight strings of eight characters; a digit is a kind, '.' is EMPTY. */
export function boardFrom(rows: readonly string[]): Board {
  if (rows.length !== BOARD_SIZE) throw new Error(`need ${BOARD_SIZE} rows`);
  const board: number[] = [];
  for (const row of rows) {
    if (row.length !== BOARD_SIZE) throw new Error(`bad row "${row}"`);
    for (const ch of row) board.push(ch === '.' ? EMPTY : Number(ch));
  }
  return board;
}

export function rowsOf(board: Board): string[] {
  const rows: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    rows.push(
      board
        .slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE)
        .map((k) => (k === EMPTY ? '.' : String(k)))
        .join(''),
    );
  }
  return rows;
}

/**
 * A five-kind board with no run and no valid swap: kind = (col + 2·row) mod 5.
 * Equal kinds only ever sit two or more apart along a line, so no single
 * exchange can line three up (board.test.ts checks that claim directly).
 */
export const STUCK_ROWS: readonly string[] = Array.from({ length: BOARD_SIZE }, (_, r) =>
  Array.from({ length: BOARD_SIZE }, (_, c) => String((c + 2 * r) % 5)).join(''),
);

/** Summary statistics for the printed measurements. */
export function summarize(values: readonly number[]): {
  min: number;
  p10: number;
  median: number;
  mean: number;
  p90: number;
  max: number;
} {
  const sorted = [...values].sort((x, y) => x - y);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  return {
    min: sorted[0]!,
    p10: at(0.1),
    median: at(0.5),
    mean: Math.round(mean * 10) / 10,
    p90: at(0.9),
    max: sorted[sorted.length - 1]!,
  };
}
