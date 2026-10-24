/** Perfect mazes generated locally with a bounded iterative depth-first traversal. */
export const SIZES = [5, 7, 9] as const;
export type Size = (typeof SIZES)[number];
export const isSize = (value: unknown): value is Size => SIZES.some((size) => size === value);
export type Direction = 'up' | 'right' | 'down' | 'left';
export const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];
export interface Session {
  size: Size;
  seed: number;
  /** Passage bits: north 1, east 2, south 4, west 8. */
  board: number[];
  position: number;
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
export function adjacent(size: number, index: number, direction: Direction): number | null {
  if (direction === 'up') return index >= size ? index - size : null;
  if (direction === 'right') return index % size < size - 1 ? index + 1 : null;
  if (direction === 'down') return index < size * (size - 1) ? index + size : null;
  return index % size > 0 ? index - 1 : null;
}
export function opening(size: Size, seed: number): number[] {
  const rng = random(seed),
    board = Array<number>(size * size).fill(0);
  const visited = new Set([0]),
    stack = [0];
  while (stack.length) {
    const current = stack.at(-1)!;
    const choices = DIRECTIONS.flatMap((direction, d) => {
      const next = adjacent(size, current, direction);
      return next !== null && !visited.has(next) ? [{ next, d }] : [];
    });
    if (!choices.length) {
      stack.pop();
      continue;
    }
    const { next, d } = choices[Math.floor(rng() * choices.length)]!;
    board[current] = board[current]! | (1 << d);
    board[next] = board[next]! | (1 << ((d + 2) % 4));
    visited.add(next);
    stack.push(next);
  }
  return board;
}
export function destinations(board: readonly number[], size: number, position: number): number[] {
  return DIRECTIONS.flatMap((direction, d) => {
    const next = adjacent(size, position, direction);
    return next !== null && (board[position]! & (1 << d)) !== 0 ? [next] : [];
  });
}
export function move(session: Session, target: number): Session | null {
  if (
    session.status !== 'playing' ||
    !destinations(session.board, session.size, session.position).includes(target)
  )
    return null;
  const solved = target === session.size * session.size - 1;
  return {
    ...session,
    position: target,
    history: [...session.history, target],
    status: solved ? 'over' : 'playing',
    cleared: session.cleared || solved,
  };
}
export function undo(session: Session): Session | null {
  if (!session.history.length) return null;
  const history = session.history.slice(0, -1);
  return { ...session, history, position: history.at(-1) ?? 0, status: 'playing' };
}
/** At most size² nodes; called only by an explicit Hint action. */
export function solution(session: Session): number[] {
  const goal = session.size * session.size - 1;
  const parents = new Map<number, number>([[session.position, -1]]),
    queue = [session.position];
  for (let head = 0; head < queue.length && !parents.has(goal); head++) {
    for (const next of destinations(session.board, session.size, queue[head]!)) {
      if (!parents.has(next)) {
        parents.set(next, queue[head]!);
        queue.push(next);
      }
    }
  }
  if (!parents.has(goal)) return [];
  const path: number[] = [];
  for (let cell = goal; cell !== session.position; cell = parents.get(cell)!) path.push(cell);
  return path.reverse();
}
export function createSession(size: Size, seed: number): Session {
  return {
    size,
    seed: seed >>> 0,
    board: opening(size, seed),
    position: 0,
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    cleared: false,
  };
}
