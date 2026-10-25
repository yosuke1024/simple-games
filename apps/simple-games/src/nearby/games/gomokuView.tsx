import '@/games/gomoku/i18n';
import '@/games/gomoku/ui/gomoku.css';
import { countStones } from '@/games/gomoku/game/types';
import { lineThrough } from '@/games/gomoku/game/engine';
import { GomokuBoard } from '@/games/gomoku/ui/components/GomokuBoard';
import { useGomokuSelection } from '@/games/gomoku/ui/useGomokuSelection';
import { useSettings } from '@/state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { adapter, type GomokuView } from './gomoku';

export default function GomokuNearby({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const state = match.state as GomokuView;
  const playing = canAct && adapter.turn(state) === seat && !adapter.finished(state);
  const { pending, onPoint } = useGomokuSelection(playing, (cell) => {
    act({ type: 'place', cell });
    return true;
  });
  const counts = countStones(state.board);
  const lastMove =
    state.last === null ? null : { placed: state.last, moveCount: counts.black + counts.white };
  return (
    <div className="gm-body">
      <div className="gm-status">
        {([seat, 1 - seat] as const).map((side) => (
          <span key={side} className="gm-side">
            <span
              className={`gm-side-stone ${side === 0 ? 'gm-side-black' : 'gm-side-white'}`}
              aria-hidden="true"
            />
            {names[side]}
          </span>
        ))}
      </div>
      <GomokuBoard
        board={state.board}
        playerColor={seat === 0 ? 1 : 2}
        playing={playing}
        pending={pending}
        lastMove={lastMove}
        winningLine={state.last === null ? null : lineThrough(state.board, state.last)}
        opponentName={names[1 - seat]}
        onPoint={onPoint}
      />
      <p className="gm-turn-line" role="status">
        {playing && pending !== null ? t('gomokuConfirmPrompt') : ''}
      </p>
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './gomoku';
