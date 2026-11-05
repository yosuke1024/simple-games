/** Fleet Search: ships never touch; CPU target selection receives public knowledge only. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (x: unknown): x is Mode => MODES.includes(x as Mode);
export const SIZE = 8,
  LENGTHS = [4, 3, 2, 2] as const;
export type Ship = number[];
export type Action =
  | { type: 'shuffle' }
  | { type: 'place'; ship: number; cell: number; vertical: boolean }
  | { type: 'start' }
  | { type: 'shot'; cell: number };
export interface Session {
  seed: number;
  mode: Mode;
  status: 'playing' | 'won' | 'lost';
  phase: 'setup' | 'player' | 'cpu';
  fleets: [Ship[], Ship[]];
  shots: [number[], number[]];
  actions: Action[];
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
export const neighbors = (cell: number) =>
  Array.from({ length: 64 }, (_, i) => i).filter(
    (i) =>
      Math.abs((i % 8) - (cell % 8)) <= 1 &&
      Math.abs(Math.floor(i / 8) - Math.floor(cell / 8)) <= 1,
  );
export function placement(cell: number, length: number, vertical: boolean): Ship | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= 64) return null;
  const r = Math.floor(cell / 8),
    c = cell % 8;
  if (vertical ? r + length > 8 : c + length > 8) return null;
  return Array.from({ length }, (_, i) => cell + i * (vertical ? 8 : 1));
}
export function validFleet(ships: Ship[]): boolean {
  if (ships.length !== 4) return false;
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i]!;
    if (ship.length !== LENGTHS[i]) return false;
    const shape = placement(ship[0]!, ship.length, ship[1]! - ship[0]! === 8);
    if (!shape || shape.some((x, j) => x !== ship[j])) return false;
    if (
      ship.some((c) =>
        ships.slice(0, i).some((other) => other.some((o) => neighbors(c).includes(o))),
      )
    )
      return false;
  }
  return true;
}
export function generateFleet(seed: number, entropy?: () => number): Ship[] {
  const rng = entropy ?? random(seed);
  const build = (ships: Ship[]): Ship[] | null => {
    if (ships.length === 4) return ships;
    const options = Array.from({ length: 128 }, (_, i) => ({ cell: i % 64, vertical: i >= 64 }));
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j]!, options[i]!];
    }
    for (const o of options) {
      const p = placement(o.cell, LENGTHS[ships.length]!, o.vertical);
      if (p && !p.some((c) => ships.some((ship) => ship.some((s) => neighbors(c).includes(s))))) {
        const r = build([...ships, p]);
        if (r) return r;
      }
    }
    return null;
  };
  return build([])!;
}
export function createSession(mode: Mode, seed: number): Session {
  return {
    seed: seed >>> 0,
    mode,
    status: 'playing',
    phase: 'setup',
    fleets: [generateFleet(seed), generateFleet(seed ^ 0x4a27bf19)],
    shots: [[], []],
    actions: [],
    elapsedSeconds: 0,
  };
}
export const sunkShips = (ships: Ship[], shots: number[]) =>
  ships.filter((ship) => ship.every((c) => shots.includes(c)));
export function act(s: Session, a: Action): Session | null {
  if (s.status !== 'playing' || !a || s.actions.length >= 512) return null;
  if (a.type === 'shuffle' && s.phase === 'setup')
    return {
      ...s,
      fleets: [generateFleet(s.seed ^ Math.imul(s.actions.length + 1, 7919)), s.fleets[1]],
      actions: [...s.actions, a],
    };
  if (a.type === 'place' && s.phase === 'setup') {
    if (!Number.isInteger(a.ship) || a.ship < 0 || a.ship > 3 || typeof a.vertical !== 'boolean')
      return null;
    const ship = placement(a.cell, LENGTHS[a.ship]!, a.vertical);
    if (!ship) return null;
    const fleet = s.fleets[0].map((v, i) => (i === a.ship ? ship : v));
    if (!validFleet(fleet)) return null;
    return { ...s, fleets: [fleet, s.fleets[1]], actions: [...s.actions, a] };
  }
  if (a.type === 'start' && s.phase === 'setup')
    return { ...s, phase: 'player', actions: [...s.actions, a] };
  if (
    a.type !== 'shot' ||
    s.phase === 'setup' ||
    !Number.isInteger(a.cell) ||
    a.cell < 0 ||
    a.cell >= 64
  )
    return null;
  const side = s.phase === 'player' ? 0 : 1,
    enemy = side === 0 ? 1 : 0;
  if (knowledge(s, side).blocked.includes(a.cell)) return null;
  const shots: [number[], number[]] = [[...s.shots[0]], [...s.shots[1]]];
  shots[side].push(a.cell);
  const won = s.fleets[enemy].every((ship) => ship.every((c) => shots[side].includes(c)));
  return {
    ...s,
    shots,
    phase: side === 0 ? 'cpu' : 'player',
    actions: [...s.actions, a],
    status: won ? (side === 0 ? 'won' : 'lost') : 'playing',
  };
}
export interface Knowledge {
  hits: number[];
  misses: number[];
  sunk: Ship[];
  remaining: number[];
  blocked: number[];
}
export function knowledge(s: Session, side: 0 | 1): Knowledge {
  const fleet = s.fleets[side === 0 ? 1 : 0],
    shots = s.shots[side],
    sunk = sunkShips(fleet, shots),
    sunkCells = sunk.flat();
  const hits = shots.filter(
    (c) => fleet.some((ship) => ship.includes(c)) && !sunkCells.includes(c),
  );
  const misses = shots.filter((c) => !fleet.some((ship) => ship.includes(c)));
  const remaining = fleet.filter((ship) => !sunk.includes(ship)).map((ship) => ship.length);
  const blocked = [...new Set([...shots, ...sunkCells.flatMap(neighbors)])];
  return { hits, misses, sunk, remaining, blocked };
}
export function chooseTarget(view: Knowledge, mode: Mode, seed: number): number {
  const unknown = Array.from({ length: 64 }, (_, i) => i).filter((c) => !view.blocked.includes(c));
  const rng = random(seed),
    scores = new Map(unknown.map((c) => [c, 0]));
  if (mode !== 'easy') {
    const forbidden = new Set([...view.misses, ...view.sunk.flat().flatMap(neighbors)]);
    for (const length of view.remaining)
      for (let cell = 0; cell < 64; cell++)
        for (const vertical of [false, true]) {
          const ship = placement(cell, length, vertical);
          if (!ship || ship.some((c) => forbidden.has(c))) continue;
          const hitCount = ship.filter((c) => view.hits.includes(c)).length;
          if (view.hits.length && hitCount === 0) continue;
          for (const c of ship)
            if (scores.has(c)) scores.set(c, scores.get(c)! + (hitCount ? 100 * hitCount : 1));
        }
    if (mode === 'normal' && !view.hits.length) return unknown[Math.floor(rng() * unknown.length)]!;
  }
  let best = -1,
    candidates: number[] = [];
  for (const c of unknown) {
    const score = scores.get(c)!;
    if (score > best) {
      best = score;
      candidates = [c];
    } else if (score === best) candidates.push(c);
  }
  return candidates[Math.floor(rng() * candidates.length)] ?? -1;
}
export const cpuAction = (s: Session): Action => ({
  type: 'shot',
  cell: chooseTarget(knowledge(s, 1), s.mode, s.seed ^ Math.imul(s.shots[1].length + 1, 104729)),
});
export const resultValue = (s: Session) => s.shots[0].length;
