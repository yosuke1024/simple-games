/** Pure normal-play Nim. See docs/NIM_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export type Move = { row: number; count: number };
export interface Session {
  schemaVersion: 1;
  seed: number;
  mode: Mode;
  moves: Move[];
  heaps: number[];
  status: 'playing' | 'won' | 'lost';
  elapsedSeconds: number;
  resultRecorded: boolean;
}
export function random(seed: number): number {
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
export const nimSum = (heaps: readonly number[]): number => heaps.reduce((a, b) => a ^ b, 0);
export function initialHeaps(seed: number): number[] {
  const heaps = Array.from({ length: 4 }, (_, i) => 2 + (random(seed + i * 997) % 7));
  if (nimSum(heaps) === 0) heaps[3] = heaps[3]! - 1;
  return heaps;
}
export function createSession(
  mode: Mode,
  seed = random(Date.now() + Math.floor(Math.random() * 0xffffffff)),
): Session {
  return {
    schemaVersion: 1,
    seed: seed >>> 0,
    mode,
    moves: [],
    heaps: initialHeaps(seed),
    status: 'playing',
    elapsedSeconds: 0,
    resultRecorded: false,
  };
}
export function legalMoves(heaps: readonly number[]): Move[] {
  return heaps.flatMap((count, row) =>
    Array.from({ length: count }, (_, i) => ({ row, count: i + 1 })),
  );
}
export function move(session: Session, action: Move): Session | null {
  const { row, count } = action;
  if (
    session.status !== 'playing' ||
    !Number.isInteger(row) ||
    row < 0 ||
    row >= 4 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > session.heaps[row]!
  )
    return null;
  const heaps = [...session.heaps];
  heaps[row] = heaps[row]! - count;
  const status = heaps.some((n) => n > 0)
    ? 'playing'
    : session.moves.length % 2 === 0
      ? 'won'
      : 'lost';
  return { ...session, heaps, moves: [...session.moves, { row, count }], status };
}
export function isCpuTurn(session: Session): boolean {
  return session.status === 'playing' && session.moves.length % 2 === 1;
}
export function cpuMove(session: Session): Move | null {
  if (!isCpuTurn(session)) return null;
  const legal = legalMoves(session.heaps);
  const xor = nimSum(session.heaps);
  const optimal = legal.find(
    ({ row, count }) => (xor ^ session.heaps[row]! ^ (session.heaps[row]! - count)) === 0,
  );
  const draw = random(session.seed + session.moves.length * 7919);
  if (optimal && (session.mode === 'hard' || (session.mode === 'normal' && draw % 10 < 7)))
    return optimal;
  return legal[random(draw) % legal.length] ?? null;
}
export function undo(session: Session): Session | null {
  if (!session.moves.length) return null;
  const keep = session.moves.length % 2 ? session.moves.length - 1 : session.moves.length - 2;
  let next = createSession(session.mode, session.seed);
  for (const action of session.moves.slice(0, keep)) next = move(next, action)!;
  return {
    ...next,
    elapsedSeconds: session.elapsedSeconds,
    resultRecorded: session.resultRecorded,
  };
}
export function parseSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (
    r.schemaVersion !== 1 ||
    !MODES.includes(r.mode as Mode) ||
    !Number.isInteger(r.seed) ||
    (r.seed as number) < 0 ||
    (r.seed as number) > 0xffffffff ||
    !Array.isArray(r.moves) ||
    r.moves.length > 32 ||
    !Number.isInteger(r.elapsedSeconds) ||
    (r.elapsedSeconds as number) < 0 ||
    (r.elapsedSeconds as number) > 1e12 ||
    typeof r.resultRecorded !== 'boolean'
  )
    return null;
  let session = createSession(r.mode as Mode, r.seed as number);
  for (const action of r.moves) {
    if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
    const next = move(session, action as Move);
    if (!next) return null;
    session = next;
  }
  if (session.status !== 'playing') return null;
  return {
    ...session,
    elapsedSeconds: r.elapsedSeconds as number,
    resultRecorded: r.resultRecorded,
  };
}
