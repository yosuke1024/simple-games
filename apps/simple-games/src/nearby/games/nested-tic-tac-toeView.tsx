import '../../games/nested-tic-tac-toe/i18n';
import '../../games/nested-tic-tac-toe/ui/nested-tic-tac-toe.css';
import {
  isFreeMove,
  legalMoves,
  playableBoards,
  positionFromMoves,
  winningLine,
} from '../../games/nested-tic-tac-toe/game/engine';
import type { Cell, SmallState } from '../../games/nested-tic-tac-toe/game/types';
import { NestedBoard } from '../../games/nested-tic-tac-toe/ui/components/NestedBoard';
import { useSettings } from '../../state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { isNestedView } from './nested-tic-tac-toe';

export default function NestedView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  if (!isNestedView(match.state)) return null;
  const position = positionFromMoves(match.state.moves)!;
  const last = position.moves.at(-1) ?? null;
  const free = isFreeMove(position);
  const view = {
    cells: Array.from(position.cells) as Cell[],
    smalls: Array.from(position.smalls) as SmallState[],
    legal: legalMoves(position),
    playable: playableBoards(position),
    freeMove: free,
    winningLine: winningLine(position),
    lastMove: last,
  };
  return (
    <div className="nt-body">
      <p className="nt-turn-line">
        {canAct ? t(free ? 'nestedTicTacToeYourTurnFree' : 'nestedTicTacToeYourTurnSent') : ''}
      </p>
      <NestedBoard
        view={view}
        playerMark={seat === 0 ? 1 : 2}
        playersTurn={canAct}
        opponentName={names[1 - seat]}
        lastMove={
          last === null
            ? null
            : {
                placed: last,
                took: position.smalls[Math.floor(last / 9)] !== 0,
                by: (position.moves.length - 1) % 2 === seat ? 'player' : 'cpu',
                moveCount: position.moves.length,
              }
        }
        onPlay={(cell) => {
          if (canAct) act({ kind: 'place', cell });
        }}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './nested-tic-tac-toe';
