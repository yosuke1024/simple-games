/** Hanoi Towers rules. Disks are indexed smallest first; each entry names its peg. */
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
export const isSolved = (board: readonly number[]) => board.every((peg) => peg === 2);
export const topDisk = (board: readonly number[], peg: number) => board.indexOf(peg);
export const encodeMove = (from: number, to: number) => from * 3 + to;
export function applyAction(board: readonly number[], action: number): number[] | null {
  if (!Number.isInteger(action) || action < 0 || action > 8) return null;
  const from = Math.floor(action / 3),
    to = action % 3;
  if (from === to) return null;
  const disk = topDisk(board, from),
    target = topDisk(board, to);
  if (disk < 0 || (target >= 0 && target < disk)) return null;
  const next = [...board];
  next[disk] = to;
  return next;
}
export function move(session: Session, action: number): Session | null {
  if (session.status !== 'playing') return null;
  const board = applyAction(session.board, action);
  if (!board) return null;
  const solved = isSolved(board);
  return {
    ...session,
    board,
    history: [...session.history, action],
    status: solved ? 'over' : 'playing',
    cleared: session.cleared || solved,
  };
}
export function undo(session: Session): Session | null {
  const action = session.history.at(-1);
  if (action === undefined) return null;
  const board = applyAction(session.board, encodeMove(action % 3, Math.floor(action / 3)));
  if (!board) return null;
  return { ...session, board, history: session.history.slice(0, -1), status: 'playing' };
}
export function createSession(size: Size, seed: number): Session {
  return {
    size,
    seed: seed >>> 0,
    board: Array<number>(size).fill(0),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    cleared: false,
  };
}
