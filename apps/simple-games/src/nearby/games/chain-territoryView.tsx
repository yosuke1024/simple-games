import { useEffect, useRef } from 'react';
import '../../games/chain-territory/i18n';
import '../../games/chain-territory/ui/chain-territory.css';
import { Board } from '../../games/chain-territory/ui/components/Board';
import { Cascade } from '../../games/chain-territory/ui/components/Cascade';
import { act as move, type Cell, type Session } from '../../games/chain-territory/game/index';
import { useMovePlayback } from '../../ui/useMovePlayback';
import { useSettings } from '../../state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { isTerritoryView, territoryState } from './chain-territory';
export default function TerritoryBoard(props: NearbyBoardProps) {
  if (!isTerritoryView(props.match.state)) return null;
  return <Surface {...props} state={territoryState(props.match.state)} />;
}
function Surface({
  state: s,
  seat,
  canAct,
  act,
  names,
  visible = true,
}: NearbyBoardProps & { state: Session }) {
  const { t } = useSettings();
  const previous = useRef(s);
  const { playback, start } = useMovePlayback<{ before: Session; after: Session }>(visible);
  useEffect(() => {
    const before = previous.current;
    previous.current = s;
    if (s.actions.length === before.actions.length + 1) {
      const after = move(before, s.actions.at(-1)!);
      if (after) start({ before, after }, Math.min(1800, Math.max(240, after.waves.length * 180)));
    }
  }, [s, start]);
  const project = (board: Cell[]): Cell[] =>
    board.map((c) => ({ ...c, owner: c.owner === 0 ? 0 : c.owner === seat + 1 ? 1 : 2 }));
  const shown = playback?.before ?? s;
  return (
    <div className="ct-body">
      <div className="ct-scoreboard">
        {[seat, 1 - seat].map((p, i) => (
          <span key={p} data-owner={i + 1} className={shown.turn === p + 1 ? 'is-turn' : ''}>
            {names[p]}{' '}
            <strong>
              {shown.board.reduce((n, c) => n + (c.owner === p + 1 ? c.count : 0), 0)}
            </strong>
          </span>
        ))}
      </div>
      <div className="ct-board-wrap">
        <Board
          board={project(s.board)}
          blocked={!canAct || !!playback}
          onPlay={act}
          lastCell={s.lastCell}
          opponentName={names[1 - seat]}
        />
        {playback ? (
          <Cascade
            key={s.actions.length}
            waves={playback.after.waves.map(project)}
            durationMs={playback.durationMs}
          />
        ) : null}
      </div>
      <p className="ct-legend">{t('chainTerritoryCapacity')}</p>
    </div>
  );
}
export { adapter } from './chain-territory';
