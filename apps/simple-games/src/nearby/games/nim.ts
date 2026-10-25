import { initialHeaps } from '../../games/nim/game/position';
import { defineGame, type Seat } from '../gameTypes';
import { exactKeys, integer, record } from './validation';

export interface NimView {
  heaps: number[];
  turn: Seat;
  last: { row: number; count: number } | null;
}
export type NimAction = { kind: 'take'; row: number; count: number };
export const isNimView = (value: unknown): value is NimView =>
  record(value) &&
  exactKeys(value, ['heaps', 'turn', 'last']) &&
  Array.isArray(value.heaps) &&
  value.heaps.length === 4 &&
  value.heaps.every((n: unknown) => integer(n, 0, 8)) &&
  integer(value.turn, 0, 1) &&
  (value.last === null ||
    (record(value.last) &&
      exactKeys(value.last, ['row', 'count']) &&
      integer(value.last.row, 0, 3) &&
      integer(value.last.count, 1, 8)));
export const isNimAction = (value: unknown): value is NimAction =>
  record(value) &&
  exactKeys(value, ['kind', 'row', 'count']) &&
  value.kind === 'take' &&
  integer(value.row, 0, 3) &&
  integer(value.count, 1, 8);
const finished = (view: NimView) => view.heaps.every((n) => n === 0);

export const adapter = defineGame<NimView, NimView, NimAction>({
  id: 'nim',
  create: (random) => ({
    heaps: initialHeaps(Math.floor(random() * 0x100000000)),
    turn: 0,
    last: null,
  }),
  project: (state) => ({
    ...state,
    heaps: [...state.heaps],
    last: state.last && { ...state.last },
  }),
  isView: isNimView,
  isAction: isNimAction,
  turn: (view) => view.turn,
  finished,
  apply: (state, seat, action) => {
    if (finished(state) || state.turn !== seat || action.count > state.heaps[action.row]!)
      return null;
    const heaps = [...state.heaps];
    heaps[action.row]! -= action.count;
    return { heaps, turn: seat === 0 ? 1 : 0, last: { row: action.row, count: action.count } };
  },
  result: (view) => ({ scores: [0, 0], winner: finished(view) ? (view.turn === 0 ? 1 : 0) : null }),
});
