import { exactKeys } from './validation';
import { hasAnyMove, placeDisc } from '@/games/reversi/game/engine';
import {
  countDiscs,
  initialBoard,
  opponentOf,
  type Board,
  type Player,
} from '@/games/reversi/game/types';
import { defineGame, integer, record, type GameResult } from '../gameTypes';

export interface ReversiLastMove {
  by: Player;
  placed: number;
  flipped: readonly number[];
  passed: Player | null;
  moveCount: number;
}
export interface ReversiView {
  board: Board;
  toMove: Player;
  lastMove: ReversiLastMove | null;
}
interface Place {
  type: 'place';
  cell: number;
}
const finished = (state: ReversiView) => !hasAnyMove(state.board, 1) && !hasAnyMove(state.board, 2);
function nextTurn(board: Board, mover: Player): { toMove: Player; passed: Player | null } {
  const other = opponentOf(mover);
  return hasAnyMove(board, other) || !hasAnyMove(board, mover)
    ? { toMove: other, passed: null }
    : { toMove: mover, passed: other };
}
export const isReversiView = (value: unknown): value is ReversiView => {
  if (
    !record(value) ||
    !exactKeys(value, ['board', 'toMove', 'lastMove']) ||
    !Array.isArray(value.board) ||
    value.board.length !== 64 ||
    !value.board.every((p) => p === 0 || p === 1 || p === 2) ||
    (value.toMove !== 1 && value.toMove !== 2)
  )
    return false;
  const board = value.board as Board;
  if ([27, 28, 35, 36].some((cell) => board[cell] === 0)) return false;
  if (value.lastMove === null)
    return value.toMove === 1 && board.every((p, i) => p === initialBoard()[i]);
  const last = value.lastMove;
  if (
    !record(last) ||
    !exactKeys(last, ['by', 'placed', 'flipped', 'passed', 'moveCount']) ||
    (last.by !== 1 && last.by !== 2) ||
    !integer(last.placed, 0, 63) ||
    board[last.placed] !== last.by ||
    !Array.isArray(last.flipped) ||
    last.flipped.length === 0 ||
    last.flipped.length > 60 ||
    new Set(last.flipped).size !== last.flipped.length ||
    !last.flipped.every(
      (cell) => integer(cell, 0, 63) && cell !== last.placed && board[cell] === last.by,
    )
  )
    return false;
  const counts = countDiscs(board);
  if (last.moveCount !== counts.black + counts.white - 4) return false;
  const before = [...board];
  before[last.placed] = 0;
  for (const cell of last.flipped) before[cell as number] = opponentOf(last.by);
  if ([27, 28, 35, 36].some((cell) => before[cell] === 0)) return false;
  const replay = placeDisc(before, last.by, last.placed);
  if (
    !replay ||
    replay.flipped.length !== last.flipped.length ||
    !replay.flipped.every((cell) => (last.flipped as number[]).includes(cell))
  )
    return false;
  const next = nextTurn(board, last.by);
  return value.toMove === next.toMove && last.passed === next.passed;
};
const result = (state: ReversiView): GameResult => {
  const { black, white } = countDiscs(state.board);
  return {
    scores: [black, white],
    winner: !finished(state) ? null : black === white ? 'draw' : black > white ? 0 : 1,
  };
};
export const adapter = defineGame<ReversiView, ReversiView, Place>({
  id: 'reversi',
  create: () => ({ board: initialBoard(), toMove: 1, lastMove: null }),
  project: (state) => ({
    ...state,
    board: [...state.board],
    lastMove: state.lastMove ? { ...state.lastMove, flipped: [...state.lastMove.flipped] } : null,
  }),
  isView: isReversiView,
  isAction: (value): value is Place =>
    record(value) &&
    exactKeys(value, ['type', 'cell']) &&
    value.type === 'place' &&
    integer(value.cell, 0, 63),
  turn: (state) => (state.toMove === 1 ? 0 : 1),
  finished,
  result,
  apply: (state, seat, action) => {
    if (finished(state) || state.toMove !== seat + 1) return null;
    const next = placeDisc(state.board, state.toMove, action.cell);
    if (!next) return null;
    const turn = nextTurn(next.board, state.toMove);
    return {
      board: next.board,
      toMove: turn.toMove,
      lastMove: {
        by: state.toMove,
        placed: action.cell,
        flipped: next.flipped,
        passed: turn.passed,
        moveCount: (state.lastMove?.moveCount ?? 0) + 1,
      },
    };
  },
});
