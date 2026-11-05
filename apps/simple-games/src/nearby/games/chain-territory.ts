import { act, createSession, type Session } from '../../games/chain-territory/game/index';
import { defineGame, integer, record } from '../gameTypes';
import { exactKeys } from './validation';
export interface TerritoryView {
  moves: number[];
}
const decoded = new WeakMap<TerritoryView, Session>();
export function territoryState(view: TerritoryView): Session {
  const cached = decoded.get(view);
  if (cached) return cached;
  let state = createSession('normal', 0);
  for (const move of view.moves) {
    const next = act(state, move, false);
    if (!next) throw new Error('Invalid territory move');
    state = next;
  }
  decoded.set(view, state);
  return state;
}
export function isTerritoryView(v: unknown): v is TerritoryView {
  if (
    !record(v) ||
    !exactKeys(v, ['moves']) ||
    !Array.isArray(v.moves) ||
    v.moves.length > 256 ||
    !v.moves.every((c) => integer(c, 0, 29))
  )
    return false;
  try {
    territoryState(v as unknown as TerritoryView);
    return true;
  } catch {
    return false;
  }
}
export const adapter = defineGame<Session, TerritoryView, number>({
  id: 'chain-territory',
  create: () => createSession('normal', 0),
  project: (s) => ({ moves: [...s.actions] }),
  isView: isTerritoryView,
  isAction: (v): v is number => integer(v, 0, 29),
  turn: (v) => (territoryState(v).turn === 1 ? 0 : 1),
  finished: (v) => territoryState(v).status !== 'playing',
  apply: (s, seat, a) => (s.turn === seat + 1 ? act(s, a, false) : null),
  result: (v) => {
    const s = territoryState(v);
    return {
      scores: [
        s.board.filter((c) => c.owner === 1).reduce((n, c) => n + c.count, 0),
        s.board.filter((c) => c.owner === 2).reduce((n, c) => n + c.count, 0),
      ],
      winner: s.status === 'playing' ? null : s.status === 'won' ? 0 : 1,
    };
  },
});
