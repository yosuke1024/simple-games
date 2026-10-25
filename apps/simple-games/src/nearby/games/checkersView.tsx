import '@/games/checkers/i18n';
import '@/games/checkers/ui/checkers.css';
import { useMemo } from 'react';
import { legalMoves, type Move } from '@/games/checkers/game/engine';
import type { Board } from '@/games/checkers/game/types';
import { CheckersBoard } from '@/games/checkers/ui/components/CheckersBoard';
import { useCheckersSelection } from '@/games/checkers/ui/useCheckersSelection';
import { useSettings } from '@/state/SettingsContext';
import type { NearbyBoardProps, Seat } from '../gameTypes';
import { adapter, type CheckersView } from './checkers';

/** The wire stays canonical; the second seat sees its own army at the bottom. */
export const localCell = (cell: number, seat: Seat) => (seat === 0 ? cell : 63 - cell);
const localMove = (move: Move, seat: Seat): Move => ({
  from: localCell(move.from, seat),
  to: localCell(move.to, seat),
  captured: move.captured === -1 ? -1 : localCell(move.captured, seat),
});
export default function CheckersNearby({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const state = match.state as CheckersView;
  const playing = canAct && adapter.turn(state) === seat && !adapter.finished(state);
  const board: Board = useMemo(
    () =>
      seat === 0
        ? state.board
        : [...state.board]
            .reverse()
            .map((p) => (p === 0 ? 0 : p === 1 ? 2 : p === 2 ? 1 : p === 3 ? 4 : 3)),
    [seat, state.board],
  );
  const moves = useMemo(
    () =>
      legalMoves(state.board, state.toMove, state.pendingJumpFrom).map((move) =>
        localMove(move, seat),
      ),
    [seat, state.board, state.toMove, state.pendingJumpFrom],
  );
  const forcedFrom = state.pendingJumpFrom === null ? null : localCell(state.pendingJumpFrom, seat);
  const { selected, targets, movable, onSquare } = useCheckersSelection(
    playing,
    moves,
    forcedFrom,
    (move) => {
      act({ type: 'step', from: localCell(move.from, seat), to: localCell(move.to, seat) });
      return true;
    },
  );
  const last = state.lastMove;
  const lastMove = last ? { ...last, move: localMove(last.move, seat) } : null;
  return (
    <div className="ck-body">
      <div className="ck-status">
        <span className="ck-side">
          <span className="ck-side-piece ck-side-you" aria-hidden="true" />
          {names[seat]}
        </span>
        <span className="ck-side">
          <span className="ck-side-piece ck-side-cpu" aria-hidden="true" />
          {names[1 - seat]}
        </span>
      </div>
      <CheckersBoard
        board={board}
        selected={selected}
        targets={targets}
        movable={movable}
        playing={playing}
        lastMove={lastMove}
        opponentName={names[1 - seat]}
        onSquare={onSquare}
      />
      <p className="ck-turn-line" role="status">
        {!playing
          ? ''
          : forcedFrom !== null
            ? t('checkersJumpAgain')
            : moves[0]?.captured !== -1
              ? t('checkersMustCapture')
              : ''}
      </p>
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './checkers';
