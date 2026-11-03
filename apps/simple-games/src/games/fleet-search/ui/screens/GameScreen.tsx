import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { knowledge, LENGTHS, placement, sunkShips, validFleet } from '../../game';
import { useFleetSearch } from '../../state/GameContext';
import { Board, coordinate } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, play, goHome, restartCurrent, startNewBoard, setPaused } = useFleetSearch();
  const [confirmRestart, setConfirmRestart] = useState(false),
    [selected, setSelected] = useState<number | null>(null),
    [ship, setShip] = useState(0),
    [vertical, setVertical] = useState(false),
    [own, setOwn] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  if (!session) return null;
  const setup = session.phase === 'setup',
    over = session.status !== 'playing',
    view = knowledge(session, 0),
    ready = session.phase === 'player';
  const proposed = selected === null ? null : placement(selected, LENGTHS[ship]!, vertical),
    valid =
      proposed !== null && validFleet(session.fleets[0].map((s, i) => (i === ship ? proposed : s)));
  const last = session.shots[1].at(-1),
    hit = last !== undefined && session.fleets[0].some((s) => s.includes(last));
  const reset = (fn: () => void) => {
    setSelected(null);
    setOwn(false);
    setShip(0);
    fn();
  };
  return (
    <div className="screen game-screen fs-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {t(setup ? 'fleetSearchArrange' : own ? 'fleetSearchOwn' : 'fleetSearchEnemy')}
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div className={`fs-body ${setup ? 'fs-setting' : ''}`}>
          {setup ? (
            <div className="fs-fleet-choices" role="group" aria-label={t('fleetSearchChooseShip')}>
              {LENGTHS.map((length, i) => (
                <button
                  type="button"
                  key={i}
                  className={`fs-ship-choice ${ship === i ? 'is-selected' : ''}`}
                  aria-label={t('fleetSearchShipSize', { n: i + 1, length })}
                  aria-pressed={ship === i}
                  onClick={() => {
                    setShip(i);
                    setSelected(session.fleets[0][i]![0]!);
                    setVertical(session.fleets[0][i]![1]! - session.fleets[0][i]![0]! === 8);
                  }}
                >
                  <span aria-hidden="true">
                    {Array.from({ length }, (_, j) => (
                      <i key={j} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="fs-fleet-status">
              <span>
                {t('fleetSearchSunkCount', {
                  n: sunkShips(session.fleets[1], session.shots[0]).length,
                })}
              </span>
              <button
                type="button"
                className="btn btn-ghost fs-view"
                onClick={() => {
                  setOwn(!own);
                  setSelected(null);
                }}
              >
                {t(own ? 'fleetSearchEnemy' : 'fleetSearchOwn')} ↔
              </button>
            </div>
          )}
          <Board
            session={session}
            own={setup || own}
            selected={selected}
            preview={setup ? (proposed ?? []) : []}
            invalid={setup && !valid}
            onSelect={(cell) => {
              if (setup) {
                setSelected(cell);
              } else if (!own && ready && !view.blocked.includes(cell)) {
                setSelected(cell);
              }
            }}
          />
          {setup ? (
            <>
              <p className="fs-message" role="status">
                {selected === null
                  ? t('fleetSearchSetupHelp')
                  : !valid
                    ? t('fleetSearchInvalid')
                    : t('fleetSearchPlaceAt', { cell: coordinate(selected) })}
              </p>
              <div className="fs-setup-tools">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setVertical(!vertical);
                    if (selected === null) setSelected(session.fleets[0][ship]![0]!);
                  }}
                >
                  {t('fleetSearchRotate')} ↻
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!valid}
                  onClick={() => {
                    if (
                      selected !== null &&
                      play({ type: 'place', ship, cell: selected, vertical })
                    ) {
                      setSelected(null);
                      sounds.select();
                    }
                  }}
                >
                  {t('fleetSearchPlace')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    play({ type: 'shuffle' });
                    setSelected(null);
                  }}
                >
                  {t('fleetSearchShuffle')}
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary fs-fire"
                onClick={() => {
                  play({ type: 'start' });
                  setSelected(null);
                  setOwn(false);
                }}
              >
                {t('startPlaying')}
              </button>
            </>
          ) : (
            <>
              <div className="fs-report">
                <Board session={session} own mini />
                <div>
                  <strong>{t('fleetSearchOwn')}</strong>
                  <p role="status">
                    {last === undefined
                      ? t('fleetSearchSelect')
                      : t('fleetSearchCpuShot', {
                          cell: coordinate(last),
                          result: t(hit ? 'fleetSearchHit' : 'fleetSearchMiss'),
                        })}
                  </p>
                  <span>
                    {t('fleetSearchRemaining', {
                      n: 4 - sunkShips(session.fleets[0], session.shots[1]).length,
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary fs-fire"
                disabled={!ready || own || selected === null || view.blocked.includes(selected)}
                onClick={() => {
                  if (selected !== null && play({ type: 'shot', cell: selected })) {
                    setSelected(null);
                    sounds.select();
                  }
                }}
              >
                {!ready
                  ? t('fleetSearchThinking')
                  : selected === null || own
                    ? t('fleetSearchSelect')
                    : t('fleetSearchFire', { cell: coordinate(selected) })}
              </button>
            </>
          )}
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={session}
        onRetry={() => reset(restartCurrent)}
        onNewBoard={() => reset(startNewBoard)}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={() => reset(restartCurrent)}
        newBoard={{ label: t('newGame'), start: () => reset(startNewBoard) }}
      />
    </div>
  );
}
