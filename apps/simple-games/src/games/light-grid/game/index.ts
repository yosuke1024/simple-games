/** Pure rules; no browser, persistence, or other-game dependencies. */
export const SIZES = [3, 4, 5] as const;
export type Size = (typeof SIZES)[number];
export const isSize = (value: unknown): value is Size => SIZES.some((size) => size === value);
export interface Session {
  size: Size;
  seed: number;
  board: number[];
  history: number[];
  status: 'playing' | 'over';
  elapsedSeconds: number;
  cleared: boolean;
}
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function neighbours(size: number, index: number): number[] {
  const out: number[] = [];
  if (index >= size) out.push(index - size);
  if (index < size * (size - 1)) out.push(index + size);
  if (index % size > 0) out.push(index - 1);
  if (index % size < size - 1) out.push(index + 1);
  return out;
}
export function toggle(board: readonly number[], size: number, index: number): number[] {
  const next = [...board];
  for (const cell of [index, ...neighbours(size, index)]) next[cell] = 1 - next[cell]!;
  return next;
}
export function opening(size: Size, seed: number): number[] {
  const rng = random(seed);
  let board: number[] = Array<number>(size * size).fill(0);
  for (let cell = 0; cell < board.length; cell++) {
    if (rng() < 0.5) board = toggle(board, size, cell);
  }
  if (board.every((cell) => cell === 0)) board = toggle(board, size, Math.floor(board.length / 2));
  return board;
}
export const isSolved = (board: readonly number[]) => board.every((cell) => cell === 0);
export function move(session: Session, index: number): Session | null {
  if (
    session.status !== 'playing' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= session.board.length
  )
    return null;
  const board = toggle(session.board, session.size, index);
  const solved = isSolved(board);
  return {
    ...session,
    board,
    history: [...session.history, index],
    status: solved ? 'over' : 'playing',
    cleared: session.cleared || solved,
  };
}
export function undo(session: Session): Session | null {
  const index = session.history.at(-1);
  if (index === undefined) return null;
  return {
    ...session,
    board: toggle(session.board, session.size, index),
    history: session.history.slice(0, -1),
    status: 'playing',
  };
}
/** RREF over GF(2). Free variables are zero: valid solution, not a minimum claim. */
export function solution(board: readonly number[], size: Size): number[] | null {
  const n = size * size;
  if (board.length !== n || board.some((cell) => cell !== 0 && cell !== 1)) return null;
  const rows = board.map((cell, index) => {
    let bits = cell << n;
    for (const affected of [index, ...neighbours(size, index)]) bits |= 1 << affected;
    return bits;
  });
  const pivots: number[] = [];
  let rank = 0;
  for (let col = 0; col < n; col++) {
    const pivot = rows.findIndex((row, index) => index >= rank && (row & (1 << col)) !== 0);
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot]!, rows[rank]!];
    for (let row = 0; row < n; row++) {
      if (row !== rank && (rows[row]! & (1 << col)) !== 0) rows[row] = rows[row]! ^ rows[rank]!;
    }
    pivots.push(col);
    rank++;
  }
  const mask = (1 << n) - 1;
  if (rows.some((row) => (row & mask) === 0 && (row & (1 << n)) !== 0)) return null;
  return pivots.filter((_, row) => (rows[row]! & (1 << n)) !== 0);
}
export function createSession(size: Size, seed: number): Session {
  return {
    size,
    seed: seed >>> 0,
    board: opening(size, seed),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    cleared: false,
  };
}
