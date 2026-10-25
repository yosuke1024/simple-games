import { positionFromMoves, takenCount } from '../../games/nested-tic-tac-toe/game/engine';
import { defineGame } from '../gameTypes';
import { exactKeys, integer, record } from './validation';

export interface NestedView {
  moves: number[];
}
export type NestedAction = { kind: 'place'; cell: number };
export const isNestedView = (v: unknown): v is NestedView =>
  record(v) &&
  exactKeys(v, ['moves']) &&
  Array.isArray(v.moves) &&
  v.moves.length <= 81 &&
  v.moves.every((n: unknown) => integer(n, 0, 80)) &&
  positionFromMoves(v.moves) !== null;
export const adapter = defineGame<NestedView, NestedView, NestedAction>({
  id: 'nested-tic-tac-toe',
  create: () => ({ moves: [] }),
  project: (s) => ({ moves: [...s.moves] }),
  isView: isNestedView,
  isAction: (v): v is NestedAction =>
    record(v) && exactKeys(v, ['kind', 'cell']) && v.kind === 'place' && integer(v.cell, 0, 80),
  turn: (s) => (s.moves.length % 2 === 0 ? 0 : 1),
  finished: (s) => positionFromMoves(s.moves)!.result !== 0,
  apply: (s, seat, a) => {
    if (s.moves.length % 2 !== seat) return null;
    const moves = [...s.moves, a.cell];
    return positionFromMoves(moves) ? { moves } : null;
  },
  result: (s) => {
    const p = positionFromMoves(s.moves)!;
    return {
      scores: [takenCount(p, 1), takenCount(p, 2)],
      winner: p.result === 0 ? null : p.result === 3 ? 'draw' : p.result === 1 ? 0 : 1,
    };
  },
});
