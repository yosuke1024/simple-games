import '../../games/ludo/i18n';
import '../../games/ludo/ui/ludo.css';
import './ludoView.css';
import { useSettings } from '@/state/SettingsContext';
import { legalMovesFor } from '../../games/ludo/game/engine';
import { HOME_PROGRESS, isSeat, SEATS } from '../../games/ludo/game/types';
import { LudoBoard } from '../../games/ludo/ui/components/LudoBoard';
import { LudoDie } from '../../games/ludo/ui/components/LudoDie';
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
        : (names[state.turn] ?? '');
  const notice =
    state.lastRoll?.kind === 'autoPass'
      ? t('ludoAutoPass')
      : state.lastRoll?.kind === 'thirdSix'
        ? t('ludoThirdSix')
        : null;
  return (
    <div className="ld-body nearby-ludo-view">
      <ul className="ld-seats nearby-ludo-seats">
        {SEATS.map((player) => {
          const home = state.pawns[player].filter((progress) => progress === HOME_PROGRESS).length;
          return (
            <li
              key={player}
              className={`ld-seat-item ${state.turn === player && state.result === null ? 'ld-seat-on' : ''}`}
            >
              <span className={`ld-chip ld-seat-${player}`} aria-hidden="true" />
              <span className="ld-seat-name">{names[player]}</span>
              <span className="ld-seat-home" aria-label={t('ludoSeatHome', { home })}>
                {home}/4
              </span>
            </li>
          );
        })}
      </ul>
      <LudoBoard
        pawns={state.pawns}
        movable={movable}
        playing={enabled}
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
        />
        <p className="ld-line" role="status">
          {notice ? `${notice} ${line}` : line}
        </p>
      </div>
    </div>
  );
}
