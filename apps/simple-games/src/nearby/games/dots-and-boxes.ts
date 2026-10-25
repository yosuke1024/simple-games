import {
  claim,
  countBoxes,
  isConsistent,
  isFinished,
} from '../../games/dots-and-boxes/game/engine';
import { emptyBoard, type Board } from '../../games/dots-and-boxes/game/types';
import { defineGame, type Seat } from '../gameTypes';
import { exactKeys, integer, record } from './validation';

export interface DotsView {
  board: Board;
  turn: Seat;
  last: number | null;
}
export type DotsAction = { kind: 'edge'; edge: number };
export function isDotsView(v: unknown): v is DotsView {
  if (
    !record(v) ||
    !exactKeys(v, ['board', 'turn', 'last']) ||
    !record(v.board) ||
    !exactKeys(v.board, ['n', 'edges', 'boxes']) ||
    !integer(v.board.n, 3, 5) ||
    typeof v.board.edges !== 'string' ||
    typeof v.board.boxes !== 'string' ||
    !integer(v.turn, 0, 1)
  )
    return false;
  const b = v.board as unknown as Board;
  return (
    isConsistent(b) &&
    (v.last === null || (integer(v.last, 0, b.edges.length - 1) && b.edges[v.last] !== '0'))
  );
}
export const createDotsAdapter = (n: 3 | 4 | 5 = 3) =>
  defineGame<DotsView, DotsView, DotsAction>({
    id: 'dots-and-boxes',
    create: () => ({ board: emptyBoard(n), turn: 0, last: null }),
    project: (s) => ({ ...s, board: { ...s.board } }),
    isView: isDotsView,
    isAction: (v): v is DotsAction =>
      record(v) && exactKeys(v, ['kind', 'edge']) && v.kind === 'edge' && integer(v.edge, 0, 59),
    turn: (s) => s.turn,
    finished: (s) => isFinished(s.board),
    apply: (s, seat, a) => {
      if (isFinished(s.board) || s.turn !== seat) return null;
      const next = claim(s.board, seat === 0 ? 1 : 2, a.edge);
      return next
        ? { board: next.board, turn: next.keepsTurn ? seat : seat === 0 ? 1 : 0, last: a.edge }
        : null;
    },
    result: (s) => {
      const { player, cpu } = countBoxes(s.board);
      return {
        scores: [player, cpu],
        winner: !isFinished(s.board) ? null : player === cpu ? 'draw' : player > cpu ? 0 : 1,
      };
    },
  });
export const adapter = createDotsAdapter();
