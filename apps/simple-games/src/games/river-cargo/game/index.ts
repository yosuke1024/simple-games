/** Pure rules; see docs/RIVER_CARGO_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
export type Cargo = 'wolf' | 'goat' | 'cabbage' | 'fox' | 'hen' | 'grain' | 'crate';
export interface Puzzle {
  cargo: Cargo[];
  conflicts: [number, number][];
  seats: number;
}
export const PUZZLES: Record<Mode, Puzzle> = {
  easy: {
    cargo: ['wolf', 'goat', 'cabbage'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 1,
  },
  normal: {
    cargo: ['wolf', 'goat', 'cabbage', 'crate'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 1,
  },
  hard: {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen', 'grain'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ],
    seats: 2,
  },
};
/** A bit per cargo item; 1 means on the right bank. */
export type Action = number;
export interface Session {
  mode: Mode;
  seed: number;
  actions: Action[];
  elapsedSeconds: number;
  mask: number;
  boat: 0 | 1;
  status: 'playing' | 'won';
  par: number;
}
export const bitCount = (mask: number) => mask.toString(2).replaceAll('0', '').length;
export function unsafePair(puzzle: Puzzle, mask: number, boat: 0 | 1): [number, number] | null {
  return (
    puzzle.conflicts.find(
      ([a, b]) => Number(!!(mask & (1 << a))) !== boat && Number(!!(mask & (1 << b))) !== boat,
    ) ?? null
  );
}
export function available(p: Puzzle, mask: number, boat: 0 | 1): number {
  const all = (1 << p.cargo.length) - 1;
  return boat ? mask : all ^ mask;
}
export function crossing(
  p: Puzzle,
  mask: number,
  boat: 0 | 1,
  cargo: number,
): { mask: number; boat: 0 | 1 } | null {
  if (
    !Number.isInteger(cargo) ||
    cargo < 0 ||
    cargo >= 1 << p.cargo.length ||
    bitCount(cargo) > p.seats ||
    (cargo & available(p, mask, boat)) !== cargo
  )
    return null;
  const next = { mask: mask ^ cargo, boat: (1 - boat) as 0 | 1 };
  return unsafePair(p, next.mask, next.boat) ? null : next;
}
export function solve(mode: Mode, mask = 0, boat: 0 | 1 = 0): Action[] | null {
  const p = PUZZLES[mode],
    all = (1 << p.cargo.length) - 1;
  if (mask === all) return [];
  const key = (m: number, b: number) => m * 2 + b;
  const start = key(mask, boat),
    queue = [{ mask, boat }];
  const prev = new Map<number, { key: number; action: number }>();
  prev.set(start, { key: -1, action: 0 });
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]!;
    for (let action = 0; action <= all; action++) {
      const next = crossing(p, current.mask, current.boat, action);
      if (!next || prev.has(key(next.mask, next.boat))) continue;
      const nextKey = key(next.mask, next.boat);
      prev.set(nextKey, { key: key(current.mask, current.boat), action });
      if (next.mask === all) {
        const path: Action[] = [];
        let at = nextKey;
        while (at !== start) {
          const step = prev.get(at)!;
          path.unshift(step.action);
          at = step.key;
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}
const pars = Object.fromEntries(MODES.map((mode) => [mode, solve(mode)!.length])) as Record<
  Mode,
  number
>;
export function createSession(mode: Mode, seed: number): Session {
  return {
    mode,
    seed: seed >>> 0,
    actions: [],
    elapsedSeconds: 0,
    mask: 0,
    boat: 0,
    status: 'playing',
    par: pars[mode],
  };
}
export function act(s: Session, action: Action): Session | null {
  if (s.status !== 'playing' || s.actions.length >= 512) return null;
  const next = crossing(PUZZLES[s.mode], s.mask, s.boat, action);
  if (!next) return null;
  return {
    ...s,
    ...next,
    actions: [...s.actions, action],
    status: next.mask === (1 << PUZZLES[s.mode].cargo.length) - 1 ? 'won' : 'playing',
  };
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  let previous = createSession(s.mode, s.seed);
  for (const a of s.actions.slice(0, -1)) previous = act(previous, a)!;
  return { ...previous, elapsedSeconds: s.elapsedSeconds };
}
export const resultValue = (s: Session) => s.actions.length;
