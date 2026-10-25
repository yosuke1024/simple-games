import { exactKeys } from './validation';
import {
  applyStep,
  hasAnyMove,
  hasJumpFrom,
  isQuietKingStep,
  legalMoves,
  type Move,
} from '@/games/checkers/game/engine';
import {
  countPieces,
  DRAW_QUIET_PLIES,
  initialBoard,
  isDarkSquare,
  isKing,
  opponentOf,
  rowOf,
  sideOf,
  sideToMove,
  type Board,
  type Side,
} from '@/games/checkers/game/types';
import { defineGame, integer, record, type GameResult } from '../gameTypes';

export interface CheckersLastMove {
  by: Side;
  move: Move;
  crowned: boolean;
  stepId: number;
}
export interface CheckersView {
  board: Board;
  toMove: Side;
  moveCount: number;
  quietPlies: number;
  pendingJumpFrom: number | null;
  lastMove: CheckersLastMove | null;
}
interface Step {
  type: 'step';
  from: number;
  to: number;
}
const finished = (state: CheckersView) =>
  state.pendingJumpFrom === null &&
  (!hasAnyMove(state.board, state.toMove) || state.quietPlies >= DRAW_QUIET_PLIES);
const result = (state: CheckersView): GameResult => {
  const win =
    state.pendingJumpFrom !== null || hasAnyMove(state.board, state.toMove)
      ? null
      : state.toMove === 1
        ? 1
        : 0;
  return {
    scores: win === 0 ? [1, 0] : win === 1 ? [0, 1] : [0, 0],
    winner: win ?? (finished(state) ? 'draw' : null),
  };
};
export const isCheckersView = (value: unknown): value is CheckersView => {
  if (
    !record(value) ||
    !exactKeys(value, [
      'board',
      'toMove',
      'moveCount',
      'quietPlies',
      'pendingJumpFrom',
      'lastMove',
    ]) ||
    !Array.isArray(value.board) ||
    value.board.length !== 64 ||
    !value.board.every(
      (p, cell) =>
        integer(p, 0, 4) &&
        (p === 0 ||
          (isDarkSquare(cell) &&
            !(p === 1 && rowOf(cell) === 0) &&
            !(p === 2 && rowOf(cell) === 7))),
    ) ||
    !integer(value.moveCount, 0, 100000) ||
    !integer(value.quietPlies, 0, DRAW_QUIET_PLIES) ||
    value.quietPlies > value.moveCount ||
    value.toMove !== sideToMove(value.moveCount, 1)
  )
    return false;
  const board = value.board as Board;
  const counts = countPieces(board);
  if (counts.player > 12 || counts.cpu > 12 || counts.player + counts.cpu === 0) return false;
  if (value.lastMove === null)
    return (
      value.moveCount === 0 &&
      value.quietPlies === 0 &&
      value.pendingJumpFrom === null &&
      board.every((p, i) => p === initialBoard()[i])
    );
  const last = value.lastMove;
  if (
    !record(last) ||
    !exactKeys(last, ['by', 'move', 'crowned', 'stepId']) ||
    (last.by !== 1 && last.by !== 2) ||
    typeof last.crowned !== 'boolean' ||
    !integer(last.stepId, 1, 100023) ||
    last.stepId < value.moveCount ||
    last.stepId > value.moveCount + 23 ||
    !record(last.move) ||
    !exactKeys(last.move, ['from', 'to', 'captured'])
  )
    return false;
  const move = last.move;
  if (
    !integer(move.from, 0, 63) ||
    !integer(move.to, 0, 63) ||
    !integer(move.captured, -1, 63) ||
    !isDarkSquare(move.from) ||
    !isDarkSquare(move.to) ||
    board[move.from] !== 0 ||
    sideOf(board[move.to]!) !== last.by
  )
    return false;
  const dr = rowOf(move.to) - rowOf(move.from),
    dc = (move.to % 8) - (move.from % 8);
  if (Math.abs(dr) !== Math.abs(dc) || Math.abs(dr) !== (move.captured === -1 ? 1 : 2))
    return false;
  if (
    move.captured !== -1 &&
    (move.captured !== (move.from + move.to) / 2 || board[move.captured] !== 0)
  )
    return false;
  if ((!isKing(board[move.to]!) || last.crowned) && Math.sign(dr) !== (last.by === 1 ? -1 : 1))
    return false;
  if ((!isKing(board[move.to]!) || last.crowned || move.captured !== -1) && value.quietPlies !== 0)
    return false;
  if (last.crowned && (!isKing(board[move.to]!) || rowOf(move.to) !== (last.by === 1 ? 0 : 7)))
    return false;
  if (value.pendingJumpFrom !== null) {
    return (
      integer(value.pendingJumpFrom, 0, 63) &&
      last.by === value.toMove &&
      move.to === value.pendingJumpFrom &&
      move.captured !== -1 &&
      !last.crowned &&
      last.stepId > value.moveCount &&
      value.quietPlies === 0 &&
      legalMoves(board, last.by, value.pendingJumpFrom).length > 0
    );
  }
  if (move.captured !== -1 && !last.crowned && hasJumpFrom(board, move.to, last.by)) return false;
  return (
    value.moveCount > 0 &&
    last.by !== value.toMove &&
    (move.captured === -1 || value.quietPlies === 0)
  );
};
export const adapter = defineGame<CheckersView, CheckersView, Step>({
  id: 'checkers',
  create: () => ({
    board: initialBoard(),
    toMove: 1,
    moveCount: 0,
    quietPlies: 0,
    pendingJumpFrom: null,
    lastMove: null,
  }),
  project: (state) => ({
    ...state,
    board: [...state.board],
    lastMove: state.lastMove ? { ...state.lastMove, move: { ...state.lastMove.move } } : null,
  }),
  isView: isCheckersView,
  isAction: (value): value is Step =>
    record(value) &&
    exactKeys(value, ['type', 'from', 'to']) &&
    value.type === 'step' &&
    integer(value.from, 0, 63) &&
    integer(value.to, 0, 63),
  turn: (state) => (state.toMove === 1 ? 0 : 1),
  finished,
  result,
  apply: (state, seat, action) => {
    if (finished(state) || state.toMove !== seat + 1) return null;
    const move = legalMoves(state.board, state.toMove, state.pendingJumpFrom).find(
      (m) => m.from === action.from && m.to === action.to,
    );
    if (!move) return null;
    const next = applyStep(state.board, move);
    const complete = next.continueFrom === null;
    return {
      board: next.board,
      toMove: complete ? opponentOf(state.toMove) : state.toMove,
      moveCount: state.moveCount + (complete ? 1 : 0),
      quietPlies: isQuietKingStep(state.board, move) ? state.quietPlies + 1 : 0,
      pendingJumpFrom: next.continueFrom,
      lastMove: {
        by: state.toMove,
        move,
        crowned: next.promoted,
        stepId: (state.lastMove?.stepId ?? 0) + 1,
      },
    };
  },
});
