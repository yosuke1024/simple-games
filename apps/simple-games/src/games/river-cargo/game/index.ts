/** Pure rules; see docs/RIVER_CARGO_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
export type Cargo = 'wolf' | 'goat' | 'cabbage' | 'fox' | 'hen' | 'grain' | 'crate';
export interface Puzzle {
  id: string;
  mode: Mode;
  cargo: Cargo[];
  conflicts: [number, number][];
  seats: number;
  weights?: number[];
  weightLimit?: number;
  crew?: number[];
  boatConflicts?: [number, number][];
}
// Fixed identities preserve replayed saves; each puzzle has a verified shortest route.
export const CATALOG: Puzzle[] = [
  {
    cargo: ['wolf', 'goat', 'cabbage'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 1,
    id: 'easy-1',
    mode: 'easy',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 2,
    id: 'easy-2',
    mode: 'easy',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'crate'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 2,
    weights: [3, 2, 1, 1],
    weightLimit: 3,
    id: 'easy-3',
    mode: 'easy',
  },
  {
    cargo: ['cabbage', 'grain', 'crate', 'fox'],
    conflicts: [],
    seats: 2,
    weights: [1, 1, 2, 3],
    weightLimit: 3,
    id: 'easy-4',
    mode: 'easy',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'crate'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 1,
    id: 'normal-1',
    mode: 'normal',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox'],
    conflicts: [
      [0, 1],
      [1, 2],
    ],
    seats: 2,
    crew: [1, 3],
    id: 'normal-2',
    mode: 'normal',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
    ],
    seats: 2,
    boatConflicts: [[0, 3]],
    id: 'normal-3',
    mode: 'normal',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
    ],
    seats: 2,
    weights: [3, 2, 1, 2, 1],
    weightLimit: 3,
    id: 'normal-4',
    mode: 'normal',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen', 'grain'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ],
    seats: 2,
    id: 'hard-1',
    mode: 'hard',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen', 'grain'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ],
    seats: 2,
    weights: [3, 2, 1, 2, 1, 1],
    weightLimit: 3,
    id: 'hard-2',
    mode: 'hard',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen', 'grain'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ],
    seats: 2,
    crew: [1, 4],
    id: 'hard-3',
    mode: 'hard',
  },
  {
    cargo: ['wolf', 'goat', 'cabbage', 'fox', 'hen', 'grain', 'crate'],
    conflicts: [
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ],
    seats: 2,
    boatConflicts: [[0, 3]],
    weights: [3, 2, 1, 2, 1, 1, 2],
    weightLimit: 4,
    crew: [1, 4],
    id: 'hard-4',
    mode: 'hard',
  },
];
export const puzzleById = (id: string) => CATALOG.find((p) => p.id === id);
// The three originally published puzzles retain their exact cargo order and rules.
export const PUZZLES = Object.fromEntries(
  MODES.map((mode) => [mode, puzzleById(mode + '-1')!]),
) as Record<Mode, Puzzle>;
/** A bit per cargo item; 1 means on the right bank. */
export type Action = number;
export interface Session {
  puzzleId: string;
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
export function cargoWeight(p: Puzzle, cargo: number): number {
  return (p.weights ?? []).reduce((sum, weight, i) => sum + (cargo & (1 << i) ? weight : 0), 0);
}
export type LoadProblem =
  { kind: 'weight' } | { kind: 'crew' } | { kind: 'together'; pair: [number, number] };
export function loadProblem(p: Puzzle, cargo: number): LoadProblem | null {
  if (p.weightLimit !== undefined && cargoWeight(p, cargo) > p.weightLimit)
    return { kind: 'weight' };
  if (p.crew?.length && !p.crew.some((i) => cargo & (1 << i))) return { kind: 'crew' };
  const pair = p.boatConflicts?.find(([a, b]) => cargo & (1 << a) && cargo & (1 << b));
  return pair ? { kind: 'together', pair } : null;
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
    (cargo & available(p, mask, boat)) !== cargo ||
    loadProblem(p, cargo) !== null
  )
    return null;
  const next = { mask: mask ^ cargo, boat: (1 - boat) as 0 | 1 };
  return unsafePair(p, next.mask, next.boat) ? null : next;
}
export function solve(puzzle: Mode | Puzzle, mask = 0, boat: 0 | 1 = 0): Action[] | null {
  const p = typeof puzzle === 'string' ? PUZZLES[puzzle] : puzzle,
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
const pars = new Map<string, number>();
export function createSession(mode: Mode, seed: number, puzzleId = mode + '-1'): Session {
  const p = puzzleById(puzzleId);
  if (!p || p.mode !== mode) throw new Error('Unknown river puzzle');
  if (!pars.has(p.id)) pars.set(p.id, solve(p)!.length);
  return {
    puzzleId,
    mode,
    seed: seed >>> 0,
    actions: [],
    elapsedSeconds: 0,
    mask: 0,
    boat: 0,
    status: 'playing',
    par: pars.get(puzzleId)!,
  };
}
export function act(s: Session, action: Action): Session | null {
  if (s.status !== 'playing' || s.actions.length >= 512) return null;
  const next = crossing(puzzleById(s.puzzleId)!, s.mask, s.boat, action);
  if (!next) return null;
  return {
    ...s,
    ...next,
    actions: [...s.actions, action],
    status: next.mask === (1 << puzzleById(s.puzzleId)!.cargo.length) - 1 ? 'won' : 'playing',
  };
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  let previous = createSession(s.mode, s.seed, s.puzzleId);
  for (const a of s.actions.slice(0, -1)) previous = act(previous, a)!;
  return { ...previous, elapsedSeconds: s.elapsedSeconds };
}
export const resultValue = (s: Session) => s.actions.length;
