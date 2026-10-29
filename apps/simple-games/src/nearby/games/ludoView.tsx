import '../../games/ludo/i18n';
import '../../games/ludo/ui/ludo.css';
import './ludoView.css';
import { useSettings } from '@/state/SettingsContext';
import { useNearbyText } from '../i18n';
import { legalMovesFor } from '../../games/ludo/game/engine';
import { bySeat, isSeat } from '../../games/ludo/game/types';
import { LudoBoard } from '../../games/ludo/ui/components/LudoBoard';
import { LudoDie } from '../../games/ludo/ui/components/LudoDie';
import { LudoPlayers } from '../../games/ludo/ui/components/LudoPlayers';
import type { State } from './ludo';

export interface LudoViewProps {
  state: State;
  seat: number;
  names: readonly string[];
  canAct: boolean;
  act: (action: unknown) => void;
  visible?: boolean;
}

/** Shared board and die, with no solo provider, save slot, statistics or timers for CPUs. */
export default function LudoView({
  state,
  seat,
  names,
  canAct,
  act,
  visible = true,
}: LudoViewProps) {
  const { t } = useSettings();
  const n = useNearbyText();
  if (!visible || !isSeat(seat)) return null;
  const ownTurn = state.result === null && state.turn === seat;
  const enabled = canAct && ownTurn;
  const movable =
    enabled && state.die !== null
      ? legalMovesFor(state, seat, state.die).map((move) => move.pawn)
      : [];
  const line =
    state.result !== null
      ? ''
      : ownTurn
        ? state.die !== null
          ? t('ludoTurnMove', { die: state.die })
          : t(state.sixStreak > 0 ? 'ludoRollAgain' : 'ludoTurnRoll')
        : n('playerTurn', { name: names[state.turn] ?? '' });
  const notice =
    state.lastRoll?.kind === 'autoPass'
      ? t('ludoAutoPass')
      : state.lastRoll?.kind === 'thirdSix'
        ? t('ludoThirdSix')
        : null;
  return (
    <div className="ld-body nearby-ludo-view">
      <LudoPlayers
        pawns={state.pawns}
        names={bySeat((player) => names[player] ?? '')}
        turn={state.result === null ? state.turn : null}
        className="nearby-ludo-seats"
      />
      <LudoBoard
        pawns={state.pawns}
        movable={movable}
        playing={enabled}
        activeSeat={state.result === null ? state.turn : undefined}
        ownSeat={seat}
        names={names}
        onPawn={(pawn) => act({ kind: 'move', pawn })}
      />
      <div className="ld-tray">
        <LudoDie
          face={state.die ?? state.lastRoll?.die ?? null}
          rollSerial={state.rollIndex}
          canRoll={enabled && state.die === null}
          onRoll={() => act({ kind: 'roll' })}
          activeSeat={state.result === null ? state.turn : undefined}
        />
        <p className="ld-line" role="status">
          {notice ? `${notice} ${line}` : line}
        </p>
      </div>
    </div>
  );
}
