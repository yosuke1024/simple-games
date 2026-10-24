/** Pure rules; no browser, persistence, or other-game dependencies. */
export const SIZES = [6, 10, 14] as const;
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
export const COLOURS = [0, 1, 2, 3, 4, 5] as const;
export const SYMBOLS = ['●', '◆', '▲', '■', '★', '✚'] as const;
export function opening(size: Size, seed: number): number[] {
  const rng = random(seed);
  const board = Array.from({ length: size * size }, () => Math.floor(rng() * 6));
  if (board.every((cell) => cell === board[0])) board[board.length - 1] = (board[0]! + 1) % 6;
  return board;
}
export function region(board: readonly number[], size: number): number[] {
  const seen = new Set<number>([0]);
  const queue = [0];
  for (let head = 0; head < queue.length; head++) {
    for (const cell of neighbours(size, queue[head]!)) {
      if (!seen.has(cell) && board[cell] === board[0]) {
        seen.add(cell);
        queue.push(cell);
      }
    }
  }
  return queue;
}
export function availableColours(board: readonly number[], size: number): number[] {
  const colours = new Set<number>();
  for (const cell of region(board, size)) {
    for (const adjacent of neighbours(size, cell))
      if (board[adjacent] !== board[0]) colours.add(board[adjacent]!);
  }
  return [...colours].sort();
}
export const isSolved = (board: readonly number[]) => board.every((cell) => cell === board[0]);
export function move(session: Session, colour: number): Session | null {
  if (
    session.status !== 'playing' ||
    !availableColours(session.board, session.size).includes(colour)
  )
    return null;
  const board = [...session.board];
  for (const cell of region(board, session.size)) board[cell] = colour;
  const solved = isSolved(board);
  return {
    ...session,
    board,
    history: [...session.history, colour],
    status: solved ? 'over' : 'playing',
    cleared: session.cleared || solved,
  };
}
export function undo(session: Session): Session | null {
  if (!session.history.length) return null;
  let next = createSession(session.size, session.seed);
  for (const colour of session.history.slice(0, -1)) next = move(next, colour)!;
  return { ...next, elapsedSeconds: session.elapsedSeconds, cleared: session.cleared };
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
