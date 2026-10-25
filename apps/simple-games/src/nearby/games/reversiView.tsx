import '@/games/reversi/i18n';
import '@/games/reversi/ui/reversi.css';
import { useEffect, useState } from 'react';
import { countDiscs } from '@/games/reversi/game/types';
import { ReversiBoard } from '@/games/reversi/ui/components/ReversiBoard';
import { useSettings } from '@/state/SettingsContext';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import type { NearbyBoardProps } from '../gameTypes';
import { adapter, type ReversiView } from './reversi';

export default function ReversiNearby({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const state = match.state as ReversiView;
  const counts = countDiscs(state.board);
  const scores = [counts.black, counts.white];
  const timeout = useTransientTimeout();
  const [passed, setPassed] = useState<number | null>(null);
  const last = state.lastMove;
  useEffect(() => {
    setPassed(last?.passed ? last.passed - 1 : null);
    if (last?.passed) timeout(() => setPassed(null), 2200);
  }, [last?.moveCount, last?.passed, timeout]);
  return (
    <div className="rv-body">
      <div className="rv-status">
        {([seat, 1 - seat] as const).map((side) => (
          <span key={side} className="rv-count">
            <span
              className={`rv-count-disc ${side === 0 ? 'rv-count-black' : 'rv-count-white'}`}
              aria-hidden="true"
            />
            {names[side]} {scores[side]}
          </span>
        ))}
      </div>
      <ReversiBoard
        board={state.board}
        playerColor={seat === 0 ? 1 : 2}
        toMove={state.toMove}
        playing={canAct && !adapter.finished(state)}
        lastMove={last}
        opponentName={names[1 - seat]}
        onPlace={(cell) => act({ type: 'place', cell })}
      />
      <p className="rv-turn-line" role="status">
        {passed === null ? '' : t('reversiPassNamed', { name: names[passed] ?? '' })}
      </p>
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './reversi';
