import { clonePosition, generateLegalMoves } from '../../games/chess/game/engine';
import { parseFen, toFen } from '../../games/chess/game/fen';
import { createGame, findMove, playMove, type Game } from '../../games/chess/game/record';
import { MAX_PLIES, type Outcome } from '../../games/chess/game/types';
import { defineGame } from '../gameTypes';
import { exactKeys, integer, record } from './validation';

export interface ChessView {
  fen: string;
  outcome: Outcome | null;
  last: number | null;
  plies: number;
}
export type ChessAction = { kind: 'move'; from: number; to: number; promotion: number };
export function isChessView(v: unknown): v is ChessView {
  if (
    !record(v) ||
    !exactKeys(v, ['fen', 'outcome', 'last', 'plies']) ||
    typeof v.fen !== 'string' ||
    v.fen.length > 110 ||
    !integer(v.plies, 0, MAX_PLIES) ||
    !(v.last === null || integer(v.last, 0, 0x7fffffff))
  )
    return false;
  const p = parseFen(v.fen);
  if (!p || p.side !== v.plies % 2 || (v.plies === 0) !== (v.last === null)) return false;
  if (v.outcome === null) return generateLegalMoves(p).length > 0;
  return (
    record(v.outcome) &&
    exactKeys(v.outcome, ['winner', 'reason']) &&
    (v.outcome.winner === null || integer(v.outcome.winner, 0, 1)) &&
    ['checkmate', 'stalemate', 'insufficient', 'repetition', 'fifty'].includes(
      String(v.outcome.reason),
    ) &&
    (v.outcome.reason === 'checkmate') === (v.outcome.winner !== null)
  );
}
export const adapter = defineGame<Game, ChessView, ChessAction>({
  id: 'chess',
  create: () => createGame(),
  project: (s) => ({
    fen: toFen(s.position),
    outcome: s.outcome && { ...s.outcome },
    last: s.moves.at(-1) ?? null,
    plies: s.moves.length,
  }),
  isView: isChessView,
  isAction: (v): v is ChessAction =>
    record(v) &&
    exactKeys(v, ['kind', 'from', 'to', 'promotion']) &&
    v.kind === 'move' &&
    integer(v.from, 0, 63) &&
    integer(v.to, 0, 63) &&
    [0, 2, 3, 4, 5].includes(v.promotion as number),
  turn: (s) => parseFen(s.fen)!.side,
  finished: (s) => s.outcome !== null,
  apply: (s, seat, a) => {
    if (s.position.side !== seat || s.outcome || s.moves.length >= MAX_PLIES) return null;
    const move = findMove(s, a.from, a.to, a.promotion);
    if (move === null) return null;
    const next: Game = {
      ...s,
      position: clonePosition(s.position),
      moves: [...s.moves],
      undos: [...s.undos],
      history: [...s.history],
      legal: [...s.legal],
    };
    return playMove(next, move) ? next : null;
  },
  result: (s) => ({ scores: [0, 0], winner: s.outcome ? (s.outcome.winner ?? 'draw') : null }),
});
