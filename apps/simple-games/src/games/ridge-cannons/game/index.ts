/** Ridge Cannons: deterministic, fixed-step artillery. RIDGE_CANNONS_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (x: unknown): x is Mode => MODES.includes(x as Mode);
export type Action = { angle: number; power: number };
export type Point = { x: number; y: number };
export type Shot = { side: 0 | 1; path: Point[]; damage: [number, number]; action: Action };
export interface Session {
  seed: number;
  mode: Mode;
  status: 'playing' | 'won' | 'lost' | 'draw';
  phase: 'player' | 'cpu';
  terrain: number[];
  hp: [number, number];
  actions: Action[];
  shots: Shot[];
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
export function createSession(mode: Mode, seed: number): Session {
  const rng = random(seed),
    peak = 130 + rng() * 65,
    center = 440 + rng() * 120;
  const terrain = Array.from({ length: 101 }, (_, i) => {
    const x = i * 10;
    return 65 + peak * Math.exp(-(((x - center) / 170) ** 2)) + 12 * Math.sin(x / 90 + (seed % 7));
  });
  // Broad, level firing ledges; only the middle ridge changes by seed.
  for (let i = 0; i < 18; i++) terrain[i] = 70;
  for (let i = 83; i <= 100; i++) terrain[i] = 70;
  return {
    seed: seed >>> 0,
    mode,
    status: 'playing',
    phase: 'player',
    terrain,
    hp: [100, 100],
    actions: [],
    shots: [],
    elapsedSeconds: 0,
  };
}
export function ground(s: Session, x: number) {
  const i = Math.max(0, Math.min(99, Math.floor(x / 10)));
  const t = Math.max(0, Math.min(1, x / 10 - i));
  return s.terrain[i]! * (1 - t) + s.terrain[i + 1]! * t;
}
export function wind(s: Session) {
  return Math.round(
    (random(s.seed ^ Math.imul(Math.floor(s.actions.length / 2) + 1, 7919))() - 0.5) * 16,
  );
}
export function simulate(s: Session, side: 0 | 1, a: Action, windValue = wind(s)): Shot {
  const angle = (a.angle * Math.PI) / 180,
    speed = a.power * 3.2,
    sign = side === 0 ? 1 : -1;
  let x = side === 0 ? 105 : 895,
    y = ground(s, x) + 15,
    vx = Math.cos(angle) * speed * sign,
    vy = Math.sin(angle) * speed;
  const path: Point[] = [{ x, y }],
    dt = 0.04,
    w = windValue;
  for (let i = 0; i < 500; i++) {
    x += vx * dt;
    y += vy * dt;
    vx += w * dt;
    vy -= 80 * dt;
    path.push({ x, y });
    if (x < 0 || x > 1000 || y < ground(s, x)) break;
  }
  const damage = ([105, 895] as const).map((tx) => {
    const d = Math.hypot(x - tx, y - (ground(s, tx) + 8));
    return d < 72 ? Math.max(0, Math.round(40 * (1 - d / 72))) : 0;
  }) as [number, number];
  return { side, path, damage, action: a };
}
export function act(s: Session, a: Action, windValue = wind(s)): Session | null {
  if (
    s.status !== 'playing' ||
    !a ||
    !Number.isInteger(a.angle) ||
    !Number.isInteger(a.power) ||
    a.angle < 10 ||
    a.angle > 80 ||
    a.power < 20 ||
    a.power > 100
  )
    return null;
  const shot = simulate(s, s.phase === 'player' ? 0 : 1, a, windValue),
    hp = s.hp.map((h, i) => Math.max(0, h - shot.damage[i]!)) as [number, number];
  const actions = [...s.actions, { angle: a.angle, power: a.power }];
  const over = hp[0] === 0 || hp[1] === 0 || actions.length === 24;
  return {
    ...s,
    hp,
    actions,
    shots: [...s.shots, shot],
    phase: s.phase === 'player' ? 'cpu' : 'player',
    status: over ? (hp[0] > hp[1] ? 'won' : hp[0] < hp[1] ? 'lost' : 'draw') : 'playing',
  };
}
export function cpuAction(s: Session): Action {
  let best: Action = { angle: 45, power: 80 },
    distance = Infinity;
  for (let angle = 14; angle <= 78; angle += 4)
    for (let power = 24; power <= 100; power += 4) {
      const shot = simulate(s, 1, { angle, power }),
        p = shot.path[shot.path.length - 1]!;
      const d = Math.hypot(p.x - 105, p.y - 78);
      if (d < distance) {
        distance = d;
        best = { angle, power };
      }
    }
  const rng = random(s.seed ^ Math.imul(s.actions.length + 1, 104729));
  const error = { easy: 36, normal: 18, hard: 4 }[s.mode];
  return {
    angle: Math.max(10, Math.min(80, Math.round(best.angle + (rng() - 0.5) * error))),
    power: Math.max(20, Math.min(100, Math.round(best.power + (rng() - 0.5) * error))),
  };
}
export const resultValue = (s: Session) => s.hp[0];
