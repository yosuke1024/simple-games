import {
  generateFleet,
  validFleet,
  placement,
  LENGTHS,
  knowledge,
  act as shoot,
  type Ship,
  type Session,
  type Knowledge,
  type Action,
} from '../../games/fleet-search/game/index';
import { defineGame, integer, record, type Seat } from '../gameTypes';
import { exactKeys } from './validation';
import { copy } from './hidden';
export interface FleetState {
  fleets: [Ship[], Ship[]];
  shots: [number[], number[]];
  ready: [boolean, boolean];
  turn: Seat;
  winner: Seat | null;
}
export interface FleetView {
  you: Seat;
  ownFleet: Ship[];
  received: number[];
  target: Knowledge;
  ready: [boolean, boolean];
  turn: Seat;
  winner: Seat | null;
  scores: [number, number];
  revealed: Ship[] | null;
}
const cells = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length <= 64 &&
  v.every((n) => integer(n, 0, 63)) &&
  new Set(v).size === v.length;
const fleet = (v: unknown): v is Ship[] => Array.isArray(v) && v.every(cells) && validFleet(v);
const known = (v: unknown): v is Knowledge =>
  record(v) &&
  exactKeys(v, ['hits', 'misses', 'sunk', 'remaining', 'blocked']) &&
  cells(v.hits) &&
  cells(v.misses) &&
  cells(v.blocked) &&
  Array.isArray(v.sunk) &&
  v.sunk.length <= 4 &&
  v.sunk.every((s) => cells(s) && s.length >= 2 && s.length <= 4) &&
  Array.isArray(v.remaining) &&
  v.remaining.length <= 4 &&
  v.remaining.every((n) => integer(n, 2, 4));
export const isFleetView = (v: unknown): v is FleetView =>
  record(v) &&
  exactKeys(v, [
    'you',
    'ownFleet',
    'received',
    'target',
    'ready',
    'turn',
    'winner',
    'scores',
    'revealed',
  ]) &&
  integer(v.you, 0, 1) &&
  fleet(v.ownFleet) &&
  cells(v.received) &&
  known(v.target) &&
  Array.isArray(v.ready) &&
  v.ready.length === 2 &&
  v.ready.every((n) => typeof n === 'boolean') &&
  integer(v.turn, 0, 1) &&
  (v.winner === null || integer(v.winner, 0, 1)) &&
  Array.isArray(v.scores) &&
  v.scores.length === 2 &&
  v.scores.every((n) => integer(n, 0, 11)) &&
  (v.revealed === null || (v.winner !== null && fleet(v.revealed)));
const session = (s: FleetState): Session => ({
  seed: 0,
  mode: 'normal',
  status: 'playing',
  phase: s.turn === 0 ? 'player' : 'cpu',
  fleets: s.fleets,
  shots: s.shots,
  actions: [],
  elapsedSeconds: 0,
});
export const isFleetAction = (v: unknown): v is Action =>
  record(v) &&
  ((exactKeys(v, ['type']) && (v.type === 'shuffle' || v.type === 'start')) ||
    (exactKeys(v, ['type', 'cell']) && v.type === 'shot' && integer(v.cell, 0, 63)) ||
    (exactKeys(v, ['type', 'ship', 'cell', 'vertical']) &&
      v.type === 'place' &&
      integer(v.ship, 0, 3) &&
      integer(v.cell, 0, 63) &&
      typeof v.vertical === 'boolean'));
export const adapter = defineGame<FleetState, FleetView, Action>({
  id: 'fleet-search',
  create: (r) => ({
    fleets: [generateFleet(0, r), generateFleet(0, r)],
    shots: [[], []],
    ready: [false, false],
    turn: 0,
    winner: null,
  }),
  project: (s, you) =>
    copy({
      you,
      ownFleet: s.fleets[you],
      received: s.shots[you === 0 ? 1 : 0],
      target: knowledge(session(s), you),
      ready: s.ready,
      turn: s.turn,
      winner: s.winner,
      scores: ([0, 1] as const).map(
        (i) =>
          s.shots[i].filter((c) => s.fleets[i === 0 ? 1 : 0].some((ship) => ship.includes(c)))
            .length,
      ) as [number, number],
      revealed: s.winner === null ? null : s.fleets[you === 0 ? 1 : 0],
    }),
  isView: isFleetView,
  isAction: isFleetAction,
  turn: (s) => s.turn,
  finished: (s) => s.winner !== null,
  apply: (s, seat, a, r) => {
    if (s.winner !== null || seat !== s.turn) return null;
    const enemy = seat === 0 ? 1 : 0;
    if (!s.ready[seat]) {
      const next = copy(s);
      if (a.type === 'shuffle') next.fleets[seat] = generateFleet(0, r);
      else if (a.type === 'start') {
        next.ready[seat] = true;
        next.turn = next.ready[enemy] ? 0 : enemy;
      } else if (a.type === 'place') {
        const ship = placement(a.cell, LENGTHS[a.ship]!, a.vertical);
        if (!ship) return null;
        next.fleets[seat][a.ship] = ship;
        if (!validFleet(next.fleets[seat])) return null;
      } else return null;
      return next;
    }
    if (!s.ready[enemy] || a.type !== 'shot') return null;
    const next = shoot(session(s), a);
    return next
      ? { ...s, shots: next.shots, turn: enemy, winner: next.status === 'playing' ? null : seat }
      : null;
  },
  result: (s) => ({ scores: s.scores, winner: s.winner }),
});
export function ownKnowledge(v: FleetView): Knowledge {
  const f = v.ownFleet,
    shots = v.received,
    sunk = f.filter((s) => s.every((c) => shots.includes(c)));
  return {
    hits: shots.filter((c) => f.some((s) => s.includes(c))),
    misses: shots.filter((c) => !f.some((s) => s.includes(c))),
    sunk,
    remaining: f.filter((s) => !sunk.includes(s)).map((s) => s.length),
    blocked: shots,
  };
}
