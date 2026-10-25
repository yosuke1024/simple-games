import { exactKeys } from './validation';
import { dropDisc, isBoardFull, lineThrough } from '@/games/connect-four/game/engine';
import {
  countPieces,
  emptyBoard,
  isValidBoard,
  PLAYER,
  sideToMove,
  type Board,
} from '@/games/connect-four/game/types';
import { defineGame, integer, record, type GameResult } from '../gameTypes';

export interface ConnectFourView {
  board: Board;
  last: number | null;
}
interface Drop {
  type: 'drop';
  col: number;
}
const winner = (state: ConnectFourView) =>
  state.last === null ? null : lineThrough(state.board, state.last);
export const isConnectFourView = (value: unknown): value is ConnectFourView => {
  if (
    !record(value) ||
    !exactKeys(value, ['board', 'last']) ||
    !Array.isArray(value.board) ||
    !isValidBoard(value.board, PLAYER)
  )
    return false;
  const board = value.board as Board;
  const { player, cpu } = countPieces(board);
  if (value.last === null) return player + cpu === 0;
  if (!integer(value.last, 0, 41) || board[value.last] !== (player === cpu ? 2 : 1)) return false;
  // The last disc must be on top; removing it must restore a non-terminal position.
  if (value.last >= 7 && board[value.last - 7] !== 0) return false;
  const before = [...board];
  before[value.last] = 0;
  return before.every((piece, cell) => piece === 0 || lineThrough(before, cell) === null);
};
const finished = (state: ConnectFourView) => winner(state) !== null || isBoardFull(state.board);
const result = (state: ConnectFourView): GameResult => {
  const line = winner(state);
  const win = line === null ? null : state.board[line[0]!] === 1 ? 0 : 1;
  return {
    scores: win === 0 ? [1, 0] : win === 1 ? [0, 1] : [0, 0],
    winner: win ?? (isBoardFull(state.board) ? 'draw' : null),
  };
};
export const adapter = defineGame<ConnectFourView, ConnectFourView, Drop>({
  id: 'connect-four',
  create: () => ({ board: emptyBoard(), last: null }),
  project: (state) => ({ board: [...state.board], last: state.last }),
  isView: isConnectFourView,
  isAction: (value): value is Drop =>
    record(value) &&
    exactKeys(value, ['type', 'col']) &&
    value.type === 'drop' &&
    integer(value.col, 0, 6),
  turn: (state) => (sideToMove(state.board, PLAYER) === 1 ? 0 : 1),
  finished,
  result,
  apply: (state, seat, action) => {
    if (finished(state) || sideToMove(state.board, PLAYER) !== seat + 1) return null;
    const next = dropDisc(state.board, seat === 0 ? 1 : 2, action.col);
    return next ? { board: next.board, last: next.cell } : null;
  },
});
