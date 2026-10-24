/** Pure, fixed-step paddle physics. See docs/PADDLE_RALLY_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const WIDTH = 320,
  HEIGHT = 420,
  PADDLE_WIDTH = 68,
  RADIUS = 6,
  TARGET = 5;
export interface Session {
  schemaVersion: 1;
  mode: Mode;
  status: 'playing' | 'won' | 'lost';
  player: number;
  cpu: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  playerScore: number;
  cpuScore: number;
  rally: number;
  serving: boolean;
  elapsedSeconds: number;
  resultRecorded: boolean;
}
export function createSession(mode: Mode): Session {
  return {
    schemaVersion: 1,
    mode,
    status: 'playing',
    player: 160,
    cpu: 160,
    x: 160,
    y: 210,
    vx: 0,
    vy: 0,
    playerScore: 0,
    cpuScore: 0,
    rally: 0,
    serving: true,
    elapsedSeconds: 0,
    resultRecorded: false,
  };
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function movePaddle(s: Session, x: number): Session {
  return s.status !== 'playing' || !Number.isFinite(x) ? s : { ...s, player: clamp(x, 40, 280) };
}
export function serve(s: Session): Session {
  if (s.status !== 'playing' || !s.serving) return s;
  const right = (s.playerScore + s.cpuScore) % 2 === 0;
  return { ...s, x: 160, y: 210, vx: right ? 90 : -90, vy: 195, rally: 0, serving: false };
}
export function step(s: Session, seconds: number): Session {
  if (s.status !== 'playing' || s.serving || !Number.isFinite(seconds) || seconds <= 0) return s;
  const dt = Math.min(seconds, 1 / 30);
  const next = { ...s };
  // Bounded tracking, with a stable positional error: the CPU never teleports.
  const target = s.vy < 0 ? s.x + Math.sin(s.rally * 2.2 + s.playerScore) * 24 : 160;
  const speed = { easy: 100, normal: 145, hard: 190 }[s.mode];
  next.cpu = clamp(s.cpu + clamp(target - s.cpu, -speed * dt, speed * dt), 40, 280);
  next.x += s.vx * dt;
  next.y += s.vy * dt;
  if (next.x < RADIUS) {
    next.x = RADIUS * 2 - next.x;
    next.vx = Math.abs(next.vx);
  }
  if (next.x > WIDTH - RADIUS) {
    next.x = (WIDTH - RADIUS) * 2 - next.x;
    next.vx = -Math.abs(next.vx);
  }
  const bottom = s.vy > 0 && s.y <= 382 && next.y >= 382;
  const top = s.vy < 0 && s.y >= 38 && next.y <= 38;
  if (bottom || top) {
    // Interpolate the contact X instead of using the end-of-frame position.
    const edge = bottom ? 382 : 38;
    const hitX = s.x + s.vx * ((edge - s.y) / s.vy);
    const paddle = bottom ? next.player : next.cpu;
    if (Math.abs(hitX - paddle) <= PADDLE_WIDTH / 2 + RADIUS) {
      const offset = clamp((hitX - paddle) / (PADDLE_WIDTH / 2), -1, 1);
      const velocity = Math.min(370, 220 + s.rally * 9);
      next.rally += 1;
      next.x = clamp(hitX, RADIUS, WIDTH - RADIUS);
      next.y = edge;
      next.vx = velocity * Math.sin(offset * 1.04);
      next.vy = velocity * Math.cos(offset * 1.04) * (bottom ? -1 : 1);
    }
  }
  if (next.y < -RADIUS || next.y > HEIGHT + RADIUS) {
    if (next.y < 0) next.playerScore += 1;
    else next.cpuScore += 1;
    next.status =
      next.playerScore === TARGET ? 'won' : next.cpuScore === TARGET ? 'lost' : 'playing';
    next.x = 160;
    next.y = 210;
    next.vx = 0;
    next.vy = 0;
    next.serving = true;
  }
  return next;
}
export function parseSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    r.schemaVersion !== 1 ||
    !MODES.includes(r.mode as Mode) ||
    r.status !== 'playing' ||
    typeof r.serving !== 'boolean' ||
    typeof r.resultRecorded !== 'boolean'
  )
    return null;
  for (const [key, low, high] of [
    ['player', 40, 280],
    ['cpu', 40, 280],
    ['x', 0, 320],
    ['y', -6, 426],
    ['vx', -370, 370],
    ['vy', -370, 370],
    ['playerScore', 0, 4],
    ['cpuScore', 0, 4],
    ['rally', 0, 1e9],
    ['elapsedSeconds', 0, 1e12],
  ] as const) {
    const v = r[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < low || v > high) return null;
  }
  for (const key of ['playerScore', 'cpuScore', 'rally', 'elapsedSeconds'])
    if (!Number.isInteger(r[key])) return null;
  if (r.serving ? r.vx !== 0 || r.vy !== 0 : Math.abs(r.vy as number) < 90) return null;
  return {
    schemaVersion: 1,
    mode: r.mode as Mode,
    status: 'playing',
    player: r.player as number,
    cpu: r.cpu as number,
    x: r.x as number,
    y: r.y as number,
    vx: r.vx as number,
    vy: r.vy as number,
    playerScore: r.playerScore as number,
    cpuScore: r.cpuScore as number,
    rally: r.rally as number,
    serving: r.serving,
    elapsedSeconds: r.elapsedSeconds as number,
    resultRecorded: r.resultRecorded,
  };
}
