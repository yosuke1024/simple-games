import { useEffect, useRef } from 'react';
import '../../games/ridge-cannons/i18n';
import '../../games/ridge-cannons/ui/ridge-cannons.css';
import { RidgeCannonsSurface } from '../../games/ridge-cannons/ui/components/RidgeCannonsSurface';
import { useMovePlayback } from '../../ui/useMovePlayback';
import type { Session, Shot } from '../../games/ridge-cannons/game/index';
import type { NearbyBoardProps } from '../gameTypes';
import { isRidgeView, ridgeState } from './ridge-cannons';
export default function RidgeBoard(props: NearbyBoardProps) {
  if (!isRidgeView(props.match.state)) return null;
  return <Surface {...props} state={props.match.state} />;
}
function Surface({
  state,
  seat,
  names,
  canAct,
  act,
  statusLabel,
  visible = true,
}: NearbyBoardProps & { state: import('./ridge-cannons').RidgeView }) {
  const current = ridgeState(state),
    previous = useRef(current);
  const { playback, start } = useMovePlayback<{ before: Session; shot: Shot }>(visible);
  useEffect(() => {
    const before = previous.current;
    previous.current = current;
    if (current.actions.length === before.actions.length + 1)
      start({ before, shot: current.shots.at(-1)! }, 1100);
  }, [current, start]);
  return (
    <RidgeCannonsSurface
      session={playback?.before ?? current}
      playback={playback}
      ready={canAct && !playback}
      play={(a) => {
        if (!canAct || playback) return false;
        act(a);
        return true;
      }}
      perspective={seat}
      names={names}
      windValue={playback ? state.shots.at(-1)!.wind : state.wind}
      statusLabel={statusLabel}
    />
  );
}
export { adapter } from './ridge-cannons';
