import { useState } from 'react';
import '../../games/fleet-search/i18n';
import '../../games/fleet-search/ui/fleet-search.css';
import { SeaBoard, coordinate } from '../../games/fleet-search/ui/components/Board';
import { Vessel } from '../../games/fleet-search/ui/components/Vessel';
import { LENGTHS, placement, validFleet } from '../../games/fleet-search/game/index';
import { useSettings } from '../../state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { isFleetView, ownKnowledge } from './fleet-search';
export default function FleetBoard({ match, seat, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const [selected, setSelected] = useState<number | null>(null),
    [ship, setShip] = useState(0),
    [vertical, setVertical] = useState(false),
    [own, setOwn] = useState(false);
  if (!isFleetView(match.state) || match.state.you !== seat) return null;
  const s = match.state,
    setup = !s.ready[seat],
    ownView = ownKnowledge(s),
    showOwn = setup || own;
  const proposed = selected === null ? null : placement(selected, LENGTHS[ship]!, vertical),
    valid = proposed !== null && validFleet(s.ownFleet.map((v, i) => (i === ship ? proposed : v)));
  const send = (a: unknown) => {
    if (canAct) {
      act(a);
      setSelected(null);
    }
  };
  return (
    <div className={`fs-body ${setup ? 'fs-setting' : ''}`}>
      <p>{t(showOwn ? 'fleetSearchOwn' : 'fleetSearchEnemy')}</p>
      {setup ? (
        <div className="fs-fleet-choices">
          {LENGTHS.map((length, i) => (
            <button
              className={`fs-ship-choice ${ship === i ? 'is-selected' : ''}`}
              key={i}
              disabled={!canAct}
              aria-pressed={ship === i}
              aria-label={t('fleetSearchShipSize', { n: i + 1, length })}
              onClick={() => {
                setShip(i);
                setSelected(s.ownFleet[i]![0]!);
                setVertical(s.ownFleet[i]![1]! - s.ownFleet[i]![0]! === 8);
              }}
            >
              <svg
                viewBox={`0 0 ${length * 10} 10`}
                style={{ width: length * 13 }}
                aria-hidden="true"
              >
                <Vessel length={length} />
              </svg>
            </button>
          ))}
        </div>
      ) : (
        <button
          className="btn btn-ghost"
          onClick={() => {
            setOwn(!own);
            setSelected(null);
          }}
        >
          {t(own ? 'fleetSearchEnemy' : 'fleetSearchOwn')} ↔
        </button>
      )}
      <SeaBoard
        own={showOwn}
        reveal={s.winner !== null}
        fleet={showOwn ? s.ownFleet : (s.revealed ?? s.target.sunk)}
        shots={
          showOwn ? s.received : [...s.target.hits, ...s.target.misses, ...s.target.sunk.flat()]
        }
        view={showOwn ? ownView : s.target}
        selected={selected}
        preview={setup ? (proposed ?? []) : []}
        invalid={setup && !valid}
        onSelect={(c) => {
          if (canAct && (setup || (!own && !s.target.blocked.includes(c)))) setSelected(c);
        }}
      />
      {setup ? (
        <>
          <p className="fs-message">
            {t(
              selected === null
                ? 'fleetSearchSetupHelp'
                : !valid
                  ? 'fleetSearchInvalid'
                  : 'fleetSearchSelect',
            )}
          </p>
          <div className="fs-setup-tools">
            <button
              className="btn btn-secondary"
              disabled={!canAct}
              onClick={() => setVertical(!vertical)}
            >
              {t('fleetSearchRotate')}
            </button>
            <button
              className="btn btn-secondary"
              disabled={!canAct || !valid}
              onClick={() => send({ type: 'place', ship, cell: selected, vertical })}
            >
              {t('fleetSearchPlace')}
            </button>
            <button
              className="btn btn-ghost"
              disabled={!canAct}
              onClick={() => send({ type: 'shuffle' })}
            >
              {t('fleetSearchShuffle')}
            </button>
          </div>
          <button
            className="btn btn-primary"
            disabled={!canAct}
            onClick={() => send({ type: 'start' })}
          >
            {t('startPlaying')}
          </button>
        </>
      ) : (
        <>
          <SeaBoard own mini fleet={s.ownFleet} shots={s.received} view={ownView} />
          <button
            className="btn btn-primary"
            disabled={!canAct || own || selected === null || s.target.blocked.includes(selected)}
            onClick={() => send({ type: 'shot', cell: selected })}
          >
            {selected === null
              ? t('fleetSearchSelect')
              : t('fleetSearchFire', { cell: coordinate(selected) })}
          </button>
        </>
      )}
    </div>
  );
}
export { adapter } from './fleet-search';
