import { exactKeys } from './validation';
import { findWinner, isBoardFull, lineThrough, placeStone } from '@/games/gomoku/game/engine';
import {
  countStones,
  emptyBoard,
  isValidBoard,
  sideToMove,
  type Board,
} from '@/games/gomoku/game/types';
import { defineGame, integer, record, type GameResult } from '../gameTypes';

export interface GomokuView {
  board: Board;
  last: number | null;
}
interface Place {
  type: 'place';
  cell: number;
}
export const isGomokuView = (value: unknown): value is GomokuView => {
  if (
    !record(value) ||
    !exactKeys(value, ['board', 'last']) ||
    !Array.isArray(value.board) ||
    !isValidBoard(value.board)
  )
    return false;
  const board = value.board as Board;
  const { black, white } = countStones(board);
  if (value.last === null) return black + white === 0;
  if (!integer(value.last, 0, 224) || board[value.last] !== (black === white ? 2 : 1)) return false;
  const before = [...board];
  before[value.last] = 0;
  return findWinner(before) === null;
};
const finished = (state: GomokuView) =>
  (state.last !== null && lineThrough(state.board, state.last) !== null) ||
  isBoardFull(state.board);
const result = (state: GomokuView): GameResult => {
  const line = state.last === null ? null : lineThrough(state.board, state.last);
  const win = line === null ? null : state.board[line[0]!] === 1 ? 0 : 1;
  return {
    scores: win === 0 ? [1, 0] : win === 1 ? [0, 1] : [0, 0],
    winner: win ?? (isBoardFull(state.board) ? 'draw' : null),
  };
};
export const adapter = defineGame<GomokuView, GomokuView, Place>({
  id: 'gomoku',
  create: () => ({ board: emptyBoard(), last: null }),
  project: (state) => ({ board: [...state.board], last: state.last }),
  isView: isGomokuView,
  isAction: (value): value is Place =>
    record(value) &&
    exactKeys(value, ['type', 'cell']) &&
    value.type === 'place' &&
    integer(value.cell, 0, 224),
  turn: (state) => (sideToMove(state.board) === 1 ? 0 : 1),
  finished,
  result,
  apply: (state, seat, action) => {
    if (finished(state) || sideToMove(state.board) !== seat + 1) return null;
    const board = placeStone(state.board, seat === 0 ? 1 : 2, action.cell);
    return board ? { board, last: action.cell } : null;
  },
});
