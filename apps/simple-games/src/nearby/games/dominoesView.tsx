import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { distinctEnds, hasLegalPlay, sameTile } from '../../games/dominoes/game/engine';
import type { Tile } from '../../games/dominoes/game/types';
import { DominoesHand } from '../../games/dominoes/ui/components/DominoesHand';
import { DominoesLine } from '../../games/dominoes/ui/components/DominoesLine';
import { TileBack } from '../../games/dominoes/ui/components/TileFace';
import '../../games/dominoes/ui/dominoes.css';
import '../../games/dominoes/i18n';
import type { NearbyBoardProps } from '../gameTypes';
import { isDominoesView } from './dominoes';

export default function DominoesView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const position = `${match.round}:${match.revision}`;
  const [choice, setChoice] = useState<{ position: string; tile: Tile } | null>(null);
  if (!isDominoesView(match.state) || match.state.seat !== seat) return null;
  const v = match.state;
  const active = canAct && v.turn === seat && v.ending === null;
  const selected = choice?.position === position ? choice.tile : null;
  const canPlay = hasLegalPlay(v.line, v.hand);
  const mayDraw = active && !canPlay && v.stockCount > 0;
  const mayPass = active && !canPlay && v.stockCount === 0;
  return (
    <div>
      <div className="dm-status">
        <span className="dm-count">
          <TileBack upright />
          {names[seat === 0 ? 1 : 0]} {v.opponentCount}
        </span>
        <span className="dm-count">
          <TileBack upright />
          {t('dominoesBoneyardShort')} {v.stockCount}
        </span>
      </div>
      <div className="dm-body">
        <DominoesLine
          line={v.line}
          choosing={active && selected !== null}
          freshIndex={null}
          onChooseEnd={(end) => {
            if (active && selected) act({ kind: 'play', tile: selected, end });
          }}
        />
        <p className="dm-status-line" role="status">
          {v.ending
            ? ''
            : !active
              ? ''
              : selected
                ? t('dominoesChooseEnd')
                : !canPlay
                  ? mayDraw
                    ? t('dominoesMustDraw')
                    : t('dominoesNoTileFits')
                  : t('dominoesYourTurn')}
        </p>
        <DominoesHand
          hand={v.hand}
          line={v.line}
          active={active}
          selected={selected}
          onTile={(tile) => {
            if (!active) return;
            if (selected && sameTile(selected, tile)) {
              setChoice(null);
              return;
            }
            const ends = distinctEnds(v.line, tile);
            if (ends.length === 2) setChoice({ position, tile });
            else if (ends.length === 1) act({ kind: 'play', tile, end: ends[0] });
          }}
        />
      </div>
      <div className="action-bar dm-actions">
        <button className="action-btn" disabled={!mayDraw} onClick={() => act({ kind: 'draw' })}>
          {t('dominoesDraw')}
        </button>
        {mayPass ? (
          <button className="action-btn" onClick={() => act({ kind: 'pass' })}>
            {t('dominoesPass')}
          </button>
        ) : null}
      </div>
      {v.pips ? (
        <p>
          {names[0]} {v.pips[0]} · {names[1]} {v.pips[1]}
        </p>
      ) : null}
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './dominoes';
