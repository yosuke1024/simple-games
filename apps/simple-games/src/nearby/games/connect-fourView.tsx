import '@/games/connect-four/i18n';
import '@/games/connect-four/ui/connect-four.css';
import { countPieces, type Board } from '@/games/connect-four/game/types';
import { lineThrough } from '@/games/connect-four/game/engine';
import { ConnectFourBoard } from '@/games/connect-four/ui/components/ConnectFourBoard';
import type { NearbyBoardProps } from '../gameTypes';
import { adapter, type ConnectFourView } from './connect-four';

export default function ConnectFourNearby({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const state = match.state as ConnectFourView;
  const board: Board =
    seat === 0 ? state.board : state.board.map((p) => (p === 0 ? 0 : p === 1 ? 2 : 1));
  const counts = countPieces(board);
  const lastMove =
    state.last === null ? null : { placed: state.last, moveCount: counts.player + counts.cpu };
  return (
    <div className="c4-body">
      <div className="c4-status">
        <span className="c4-side">
          <span className="c4-side-disc c4-side-you" aria-hidden="true" />
          {names[seat]}
        </span>
        <span className="c4-side">
          <span className="c4-side-disc c4-side-cpu" aria-hidden="true" />
          {names[1 - seat]}
        </span>
      </div>
      <ConnectFourBoard
        board={board}
        playing={canAct && adapter.turn(state) === seat && !adapter.finished(state)}
        lastMove={lastMove}
        winningLine={state.last === null ? null : lineThrough(state.board, state.last)}
        discNames={[names[seat] ?? '', names[1 - seat] ?? '']}
        onDrop={(col) => act({ type: 'drop', col })}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './connect-four';
