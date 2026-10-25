import '../../games/dots-and-boxes/i18n';
import '../../games/dots-and-boxes/ui/dots-and-boxes.css';
import { DotsAndBoxesBoard } from '../../games/dots-and-boxes/ui/components/DotsAndBoxesBoard';
import type { NearbyBoardProps } from '../gameTypes';
import { isDotsView } from './dots-and-boxes';

export default function DotsView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  if (!isDotsView(match.state)) return null;
  const { board, last } = match.state;
  const local =
    seat === 0
      ? board
      : {
          ...board,
          edges: board.edges.replace(/[12]/g, (c) => (c === '1' ? '2' : '1')),
          boxes: board.boxes.replace(/[pc]/g, (c) => (c === 'p' ? 'c' : 'p')),
        };
  return (
    <div className="db-body">
      <DotsAndBoxesBoard
        board={local}
        playersTurn={canAct}
        opponentName={names[1 - seat]}
        lastMove={
          last === null
            ? null
            : {
                edge: last,
                by: local.edges[last] === '1' ? 1 : 2,
                completed: [],
                moveCount: match.revision,
              }
        }
        onEdge={(edge) => {
          if (canAct) act({ kind: 'edge', edge });
        }}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter, createDotsAdapter } from './dots-and-boxes';
