/** Frost Route. BFS has at most size² × 8 states; generation has a fixed attempt cap. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (x: unknown): x is Mode => MODES.includes(x as Mode);
export type Action = 0 | 1 | 2 | 3;
export interface Board {
  size: number;
  walls: number[];
  start: number;
  exit: number;
  gems: number[];
  par: number;
}
export interface Session {
  seed: number;
  mode: Mode;
  board: Board;
  position: number;
  mask: number;
  actions: Action[];
  status: 'playing' | 'won';
  phase: 'player';
  elapsedSeconds: number;
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function slide(board: Board, position: number, mask: number, direction: Action) {
  const path: number[] = [];
  const [dr, dc] = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ][direction]!;
  while (true) {
    const r = Math.floor(position / board.size) + dr!,
      c = (position % board.size) + dc!;
    if (
      r < 0 ||
      c < 0 ||
      r >= board.size ||
      c >= board.size ||
      board.walls.includes(r * board.size + c)
    )
      break;
    position = r * board.size + c;
    path.push(position);
    const gem = board.gems.indexOf(position);
    if (gem >= 0) mask |= 1 << gem;
  }
  return { position, mask, path };
}
export function solve(board: Board, position = board.start, mask = 0): Action[] | null {
  const start = position * 8 + mask,
    queue = [start],
    seen = new Map<number, { from: number; direction: Action }>();
  seen.set(start, { from: -1, direction: 0 });
  for (let head = 0; head < queue.length; head++) {
    const node = queue[head]!,
      p = Math.floor(node / 8),
      m = node % 8;
    if (p === board.exit && m === 7) {
      const route: Action[] = [];
      let cursor = node;
      while (seen.get(cursor)!.from !== -1) {
        const edge = seen.get(cursor)!;
        route.push(edge.direction);
        cursor = edge.from;
      }
      return route.reverse();
    }
    for (const dir of [0, 1, 2, 3] as const) {
      const next = slide(board, p, m, dir),
        key = next.position * 8 + next.mask;
      if (next.path.length && !seen.has(key)) {
        seen.set(key, { from: node, direction: dir });
        queue.push(key);
      }
    }
  }
  return null;
}
export function generate(mode: Mode, seed: number): Board {
  const size = { easy: 7, normal: 8, hard: 9 }[mode],
    rng = random(seed),
    start = (size - 1) * size,
    exit = size - 1;
  let fallback: Board = { size, walls: [], start, exit, gems: [0, exit, size * size - 1], par: 4 };
  for (let attempt = 0; attempt < 80; attempt++) {
    const walls = Array.from({ length: size * size }, (_, i) => i).filter(
      (i) => i !== start && i !== exit && rng() < 0.22,
    );
    const open = Array.from({ length: size * size }, (_, i) => i).filter(
      (i) => i !== start && i !== exit && !walls.includes(i),
    );
    if (open.length < 3) continue;
    const gems: number[] = [];
    for (let i = 0; i < 3; i++) {
      const j = Math.floor(rng() * open.length);
      gems.push(open.splice(j, 1)[0]!);
    }
    const board: Board = { size, walls, start, exit, gems, par: 0 },
      solution = solve(board);
    if (!solution) continue;
    board.par = solution.length;
    fallback = board;
    if (solution.length >= { easy: 6, normal: 8, hard: 10 }[mode]) return board;
  }
  fallback.par = solve(fallback)!.length;
  return fallback;
}
export function createSession(mode: Mode, seed: number): Session {
  const board = generate(mode, seed);
  return {
    seed: seed >>> 0,
    mode,
    board,
    position: board.start,
    mask: 0,
    actions: [],
    status: 'playing',
    phase: 'player',
    elapsedSeconds: 0,
  };
}
export function act(s: Session, a: Action): Session | null {
  if (s.status !== 'playing' || ![0, 1, 2, 3].includes(a) || s.actions.length >= 512) return null;
  const next = slide(s.board, s.position, s.mask, a);
  if (!next.path.length) return null;
  return {
    ...s,
    position: next.position,
    mask: next.mask,
    actions: [...s.actions, a],
    status: next.position === s.board.exit && next.mask === 7 ? 'won' : 'playing',
  };
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  let next: Session = { ...s, position: s.board.start, mask: 0, actions: [], status: 'playing' };
  for (const a of s.actions.slice(0, -1)) next = act(next, a)!;
  return next;
}
export const resultValue = (s: Session) => s.actions.length;
