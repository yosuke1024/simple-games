/** Pure rules; see docs/MARBLE_WEAVE_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
export const CONFIG = {
  easy: { size: 7, colors: 4, target: 4 },
  normal: { size: 9, colors: 6, target: 5 },
  hard: { size: 9, colors: 7, target: 5 },
};
export interface Action {
  from: number;
  to: number;
}
export interface Session {
  mode: Mode;
  seed: number;
  actions: Action[];
  elapsedSeconds: number;
  board: number[];
  rng: number;
  next: number[];
  score: number;
  status: 'playing' | 'lost';
  path: number[];
  cleared: number[];
  spawned: number[];
  movedBoard: number[];
  spawnedBoard: number[];
}
function random(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(next ^ (next >>> 15), next | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
function drawColors(rng: number, colors: number): { next: number[]; rng: number } {
  const next: number[] = [];
  for (let i = 0; i < 3; i++) {
    const [n, state] = random(rng);
    rng = state;
    next.push(1 + Math.floor(n * colors));
  }
  return { next, rng };
}
export function neighbors(cell: number, size: number): number[] {
  const x = cell % size,
    y = Math.floor(cell / size);
  return [
    y ? cell - size : -1,
    x < size - 1 ? cell + 1 : -1,
    y < size - 1 ? cell + size : -1,
    x ? cell - 1 : -1,
  ].filter((n) => n >= 0);
}
export function reachable(board: number[], from: number, size: number): number[] {
  if (!board[from]) return [];
  const queue = [from],
    seen = new Set(queue);
  for (let head = 0; head < queue.length; head++)
    for (const n of neighbors(queue[head]!, size)) {
      if (!board[n] && !seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  return queue.slice(1);
}
export function findPath(board: number[], from: number, to: number, size: number): number[] | null {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    !board[from] ||
    board[to] !== 0 ||
    from === to
  )
    return null;
  const queue = [from],
    prev = new Map<number, number>([[from, -1]]);
  for (let head = 0; head < queue.length; head++)
    for (const n of neighbors(queue[head]!, size)) {
      if (board[n] || prev.has(n)) continue;
      prev.set(n, queue[head]!);
      if (n === to) {
        const path = [to];
        let at = to;
        while (prev.get(at)! >= 0) {
          at = prev.get(at)!;
          path.unshift(at);
        }
        return path;
      }
      queue.push(n);
    }
  return null;
}
export function lines(board: number[], cells: number[], size: number, target: number): number[] {
  const cleared = new Set<number>();
  for (const cell of cells) {
    if (!board[cell]) continue;
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ]) {
      const row = [cell];
      for (const sign of [-1, 1]) {
        let x = (cell % size) + dx! * sign,
          y = Math.floor(cell / size) + dy! * sign;
        while (x >= 0 && x < size && y >= 0 && y < size && board[y * size + x] === board[cell]) {
          row.push(y * size + x);
          x += dx! * sign;
          y += dy! * sign;
        }
      }
      if (row.length >= target) row.forEach((n) => cleared.add(n));
    }
  }
  return [...cleared];
}
function spawn(board: number[], colors: number[], rng: number): { rng: number; spawned: number[] } {
  const empty = board.flatMap((v, i) => (v ? [] : [i])),
    spawned: number[] = [];
  for (const color of colors) {
    if (!empty.length) break;
    const [r, next] = random(rng);
    rng = next;
    const cell = empty.splice(Math.floor(r * empty.length), 1)[0]!;
    board[cell] = color;
    spawned.push(cell);
  }
  return { rng, spawned };
}
export function createSession(mode: Mode, seed: number): Session {
  const { size, colors, target } = CONFIG[mode];
  const board = Array<number>(size * size).fill(0);
  let rng = seed >>> 0;
  // Five initial marbles, never an unexplained already-completed line.
  for (let i = 0; i < 5; i++) {
    const draw = drawColors(rng, colors);
    const result = spawn(board, [draw.next[0]!], draw.rng);
    rng = result.rng;
    const cell = result.spawned[0]!;
    while (lines(board, [cell], size, target).length) board[cell] = (board[cell]! % colors) + 1;
  }
  const draw = drawColors(rng, colors);
  return {
    mode,
    seed: seed >>> 0,
    actions: [],
    elapsedSeconds: 0,
    board,
    ...draw,
    score: 0,
    status: 'playing',
    path: [],
    cleared: [],
    spawned: [],
    movedBoard: board,
    spawnedBoard: board,
  };
}
export function act(s: Session, action: Action): Session | null {
  if (s.status !== 'playing' || !action || typeof action !== 'object') return null;
  const { size, target, colors } = CONFIG[s.mode];
  const path = findPath(s.board, action.from, action.to, size);
  if (!path) return null;
  const board = [...s.board];
  board[action.to] = board[action.from]!;
  board[action.from] = 0;
  const movedBoard = [...board];
  let cleared = lines(board, [action.to], size, target),
    rng = s.rng,
    next = s.next;
  let spawned: number[] = [];
  if (!cleared.length) {
    const result = spawn(board, next, rng);
    rng = result.rng;
    spawned = result.spawned;
    cleared = lines(board, spawned, size, target);
    const draw = drawColors(rng, colors);
    rng = draw.rng;
    next = draw.next;
  }
  const spawnedBoard = [...board];
  cleared.forEach((cell) => {
    board[cell] = 0;
  });
  const actions = [...s.actions, { from: action.from, to: action.to }];
  return {
    ...s,
    board,
    rng,
    next,
    actions,
    path,
    cleared,
    spawned,
    movedBoard,
    spawnedBoard,
    score: s.score + cleared.length * 10 + Math.max(0, cleared.length - target) * 5,
    status: !board.includes(0) || actions.length >= 4096 ? 'lost' : 'playing',
  };
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  let previous = createSession(s.mode, s.seed);
  for (const a of s.actions.slice(0, -1)) previous = act(previous, a)!;
  return { ...previous, elapsedSeconds: s.elapsedSeconds };
}
export const resultValue = (s: Session) => s.score;
