import '../../games/backgammon/i18n';
import '../../games/backgammon/ui/backgammon.css';
import { BackgammonBoard } from '../../games/backgammon/ui/components/BackgammonBoard';
import { Dice } from '../../games/backgammon/ui/components/Dice';
import { useBackgammonSelection } from '../../games/backgammon/ui/useBackgammonSelection';
import { pipCount } from '../../games/backgammon/game/types';
import { useSettings } from '../../state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { isBackgammonView, steps } from './backgammon';
export default function BackgammonNearby(props: NearbyBoardProps) {
  if (!isBackgammonView(props.match.state)) return null;
  return <Surface {...props} state={props.match.state} />;
}
function Surface({
  state: s,
  canAct,
  act,
  seat,
  names,
}: NearbyBoardProps & { state: import('./backgammon').BackgammonView }) {
  const { t } = useSettings();
  const selection = useBackgammonSelection(canAct && s.phase === 'move', steps(s), (step) => {
    act({ kind: 'move', ...step });
    return true;
  });
  const board =
    seat === 0
      ? s.board
      : {
          points: [
            0,
            ...s.board.points
              .slice(1)
              .reverse()
              .map((n) => -n),
          ],
          bar: [s.board.bar[1], s.board.bar[0]] as const,
          off: [s.board.off[1], s.board.off[0]] as const,
        };
  return (
    <div className="bk-body">
      <p>
        {names[seat]} · {pipCount(board, 1)} / {names[1 - seat]} · {pipCount(board, 2)}
      </p>
      <BackgammonBoard
        board={board}
        opponentName={names[1 - seat]}
        {...selection}
        playing={canAct && s.phase === 'move'}
        lastStep={null}
      />
      <Dice
        roll={s.roll}
        remaining={s.dice}
        canRoll={canAct && (s.phase === 'roll' || s.phase === 'opening')}
        opening={s.phase === 'opening'}
        rollKey={s.rolls}
        onRoll={() => act({ kind: 'roll' })}
      />
      {s.resultKind ? <p>{t(`backgammonKind_${s.resultKind}`)}</p> : null}
    </div>
  );
}
export { adapter } from './backgammon';
