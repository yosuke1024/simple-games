import {
  createSession,
  act,
  type Session,
  type Action,
} from '../../games/ridge-cannons/game/index';
import { defineGame, integer, record } from '../gameTypes';
import { exactKeys } from './validation';
import { copy } from './hidden';
export interface RidgeView {
  terrainSeed: number;
  shots: (Action & { wind: number })[];
  wind: number;
}
const decoded = new WeakMap<RidgeView, Session>();
export function ridgeState(v: RidgeView): Session {
  const cached = decoded.get(v);
  if (cached) return cached;
  let s = createSession('normal', v.terrainSeed);
  for (const shot of v.shots) {
    const next = act(s, shot, shot.wind);
    if (!next) throw new Error('Invalid shot');
    s = next;
  }
  decoded.set(v, s);
  return s;
}
export const isRidgeAction = (v: unknown): v is Action =>
  record(v) &&
  exactKeys(v, ['angle', 'power']) &&
  integer(v.angle, 10, 80) &&
  integer(v.power, 20, 100);
export function isRidgeView(v: unknown): v is RidgeView {
  if (
    !record(v) ||
    !exactKeys(v, ['terrainSeed', 'shots', 'wind']) ||
    !integer(v.terrainSeed, 0, 0xffffffff) ||
    !integer(v.wind, -8, 8) ||
    !Array.isArray(v.shots) ||
    v.shots.length > 24 ||
    !v.shots.every(
      (a) =>
        record(a) &&
        exactKeys(a, ['angle', 'power', 'wind']) &&
        integer(a.angle, 10, 80) &&
        integer(a.power, 20, 100) &&
        integer(a.wind, -8, 8),
    )
  )
    return false;
  try {
    ridgeState(v as unknown as RidgeView);
    return true;
  } catch {
    return false;
  }
}
export const adapter = defineGame<RidgeView, RidgeView, Action>({
  id: 'ridge-cannons',
  create: (r) => ({
    terrainSeed: Math.floor(r() * 0x100000000),
    shots: [],
    wind: Math.round((r() - 0.5) * 16),
  }),
  project: copy,
  isView: isRidgeView,
  isAction: isRidgeAction,
  turn: (v) => (v.shots.length % 2 === 0 ? 0 : 1),
  finished: (v) => ridgeState(v).status !== 'playing',
  apply: (s, seat, a, r) => {
    if (s.shots.length % 2 !== seat || !act(ridgeState(s), a, s.wind)) return null;
    return {
      ...s,
      shots: [...s.shots, { ...a, wind: s.wind }],
      wind: seat === 1 ? Math.round((r() - 0.5) * 16) : s.wind,
    };
  },
  result: (v) => {
    const s = ridgeState(v);
    return {
      scores: s.hp,
      winner:
        s.status === 'playing' ? null : s.status === 'won' ? 0 : s.status === 'lost' ? 1 : 'draw',
    };
  },
});
