/** Pure knight-tour rules; generation only transforms proven bundled tours. */
import { TOURS } from './tours';
export { TOURS };
export const MODES = [5, 6, 8] as const;
export type Mode = (typeof MODES)[number];
export interface Session {
  schemaVersion: 1;
  seed: number;
  mode: Mode;
  path: number[];
  status: 'playing' | 'won';
  elapsedSeconds: number;
  resultRecorded: boolean;
}
export function random(seed: number): number {
  let x = seed >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
export function isKnightMove(size: number, from: number, to: number): boolean {
  const dr = Math.abs(Math.floor(from / size) - Math.floor(to / size));
  const dc = Math.abs((from % size) - (to % size));
  return dr * dc === 2;
}
export function routeFor(mode: Mode, seed: number): number[] {
  const hash = random(seed),
    route = TOURS[mode][hash % TOURS[mode].length]!;
  const symmetry = (hash >>> 8) % 8;
  const transformed = route.map((cell) => {
    let r = Math.floor(cell / mode),
      c = cell % mode;
    if (symmetry >= 4) c = mode - 1 - c;
    for (let rotation = 0; rotation < symmetry % 4; rotation++) [r, c] = [c, mode - 1 - r];
    return r * mode + c;
  });
  return hash & 0x10000 ? transformed.reverse() : transformed;
}
export function createSession(
  mode: Mode,
  seed = random(Date.now() + Math.floor(Math.random() * 0xffffffff)),
): Session {
  return {
    schemaVersion: 1,
    seed: seed >>> 0,
    mode,
    path: [routeFor(mode, seed)[0]!],
    status: 'playing',
    elapsedSeconds: 0,
    resultRecorded: false,
  };
}
export function legalMoves(session: Session): number[] {
  if (session.status !== 'playing') return [];
  const used = new Set(session.path),
    last = session.path[session.path.length - 1]!;
  return Array.from({ length: session.mode ** 2 }, (_, i) => i).filter(
    (i) => !used.has(i) && isKnightMove(session.mode, last, i),
  );
}
export function move(session: Session, cell: number): Session | null {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= session.mode ** 2 ||
    !legalMoves(session).includes(cell)
  )
    return null;
  const path = [...session.path, cell];
  return { ...session, path, status: path.length === session.mode ** 2 ? 'won' : 'playing' };
}
export function undo(session: Session): Session | null {
  return session.path.length > 1
    ? { ...session, path: session.path.slice(0, -1), status: 'playing' }
    : null;
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
    !Array.isArray(r.path) ||
    r.path.length < 1 ||
    r.path.length >= (r.mode as number) ** 2 ||
    !Number.isInteger(r.elapsedSeconds) ||
    (r.elapsedSeconds as number) < 0 ||
    (r.elapsedSeconds as number) > 1e12 ||
    typeof r.resultRecorded !== 'boolean'
  )
    return null;
  let session = createSession(r.mode as Mode, r.seed as number);
  if (r.path[0] !== session.path[0]) return null;
  for (const cell of r.path.slice(1)) {
    const next = move(session, cell as number);
    if (!next) return null;
    session = next;
  }
  return {
    ...session,
    elapsedSeconds: r.elapsedSeconds as number,
    resultRecorded: r.resultRecorded,
  };
}
