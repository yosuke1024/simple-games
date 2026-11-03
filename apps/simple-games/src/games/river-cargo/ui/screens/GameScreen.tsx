import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo, IconHint } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { bitCount, puzzleById, solve, unsafePair, cargoWeight, loadProblem } from '../../game';
import { useRiverCargo } from '../../state/GameContext';
import { CargoIcon } from '../components/CargoIcon';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, applyUndo, goHome, restartCurrent, startNewBoard, setPaused } =
    useRiverCargo();
  const [confirmRestart, setConfirmRestart] = useState(false),
    [selected, setSelected] = useState(0),
    [hint, setHint] = useState<number | null>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const reset = (fn: () => void) => {
    setSelected(0);
    setHint(null);
    setNotice('');
    fn();
  };
  const undo = () => {
    if (applyUndo()) {
      setSelected(0);
      setHint(null);
      setNotice('');
      sounds.undo();
    }
  };
  const over = session?.status !== 'playing';
  useGameKeys(
    (e) => {
      if (isUndoKey(e)) {
        if (!e.repeat) undo();
        return true;
      }
      return false;
    },
    !over && !confirmRestart && !playback,
  );
  if (!session) return null;
  const puzzle = puzzleById(session.puzzleId)!,
    shown = playback?.before ?? session;
  const crewNames = (puzzle.crew ?? []).map((i) => t(`riverCargo_${puzzle.cargo[i]!}`)).join(' / ');
  const issue = loadProblem(puzzle, selected);
  const passengers = playback ? playback.after.actions.at(-1)! : selected;
  const conflict = unsafePair(puzzle, session.mask ^ selected, (1 - session.boat) as 0 | 1);
  const load = (i: number) => {
    if (playback) return;
    setNotice('');
    setHint(null);
    if (puzzle.seats === 1) setSelected(selected === 1 << i ? 0 : 1 << i);
    else if (selected & (1 << i)) setSelected(selected ^ (1 << i));
    else if (bitCount(selected) < puzzle.seats) setSelected(selected | (1 << i));
    else setNotice(t('riverCargoFull', { n: puzzle.seats }));
  };
  const cross = () => {
    if (playback) return;
    if (issue) {
      setNotice(
        issue.kind === 'weight'
          ? t('riverCargoOverweight', { n: puzzle.weightLimit! })
          : issue.kind === 'crew'
            ? t('riverCargoNeedCrew', { cargo: crewNames })
            : t('riverCargoBoatConflict', {
                a: t(`riverCargo_${puzzle.cargo[issue.pair[0]]!}`),
                b: t(`riverCargo_${puzzle.cargo[issue.pair[1]]!}`),
              }),
      );
      return;
    }
    if (conflict) {
      setNotice(
        t('riverCargoUnsafe', {
          a: t(`riverCargo_${puzzle.cargo[conflict[0]]!}`),
          b: t(`riverCargo_${puzzle.cargo[conflict[1]]!}`),
        }),
      );
      return;
    }
    if (play(selected)) {
      setSelected(0);
      setHint(null);
      setNotice('');
      sounds.select();
    } else setNotice(t('riverCargoLimit'));
  };
  return (
    <div className="screen game-screen rg-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {t(`riverCargoMode_${session.mode}`)} ·{' '}
            {t('riverCargoPuzzle', { n: session.puzzleId.split('-')[1]! })}
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
        <div className="rg-body">
          <div className="rg-metrics">
            <span>
              {t('movesLabel')} <strong>{session.actions.length}</strong>
            </span>
            <span>
              {t('riverCargoPar')} <strong>{session.par}</strong>
            </span>
            <span>{t('riverCargoSeats', { n: puzzle.seats })}</span>
          </div>
          {puzzle.weightLimit !== undefined ? (
            <p className="rg-weight-total">
              {t('riverCargoWeight', { n: cargoWeight(puzzle, selected), max: puzzle.weightLimit })}
            </p>
          ) : null}
          <div
            className="rg-landscape"
            data-cargo-count={puzzle.cargo.length}
            role="group"
            aria-label={t('riverCargoField')}
          >
            {([0, 1] as const).map((bank) => (
              <section
                className={'rg-bank rg-bank-' + bank}
                key={bank}
                aria-label={t(bank ? 'riverCargoRight' : 'riverCargoLeft')}
              >
                <h2>{t(bank ? 'riverCargoRight' : 'riverCargoLeft')}</h2>
                <div className="rg-cargo-grid">
                  {puzzle.cargo.map((cargo, i) => {
                    const present = Number(!!(shown.mask & (1 << i))) === bank;
                    return (
                      <div className="rg-cargo-slot" key={i}>
                        {present ? (
                          <button
                            type="button"
                            className={
                              'rg-cargo ' +
                              (selected & (1 << i) ? 'is-selected ' : '') +
                              (hint !== null && hint & (1 << i) ? 'is-hint' : '')
                            }
                            aria-label={
                              puzzle.weights
                                ? t('riverCargoWeightedCargo', {
                                    cargo: t(`riverCargo_${cargo}`),
                                    n: puzzle.weights[i]!,
                                  })
                                : t(`riverCargo_${cargo}`)
                            }
                            aria-pressed={!!(selected & (1 << i))}
                            disabled={!!playback || session.boat !== bank}
                            onClick={() => load(i)}
                          >
                            <CargoIcon cargo={cargo} />
                            <span>
                              {t(`riverCargo_${cargo}`)}
                              {puzzle.weights ? (
                                <small className="rg-cargo-weight" aria-hidden="true">
                                  {puzzle.weights[i]}
                                </small>
                              ) : null}
                            </span>
                          </button>
                        ) : (
                          <span className="rg-empty-slot" aria-hidden="true" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            <div className="rg-river" aria-label={t('riverCargoBoat')}>
              <div className={'rg-boat rg-boat-' + session.boat + (playback ? ' is-crossing' : '')}>
                <div className="rg-passengers">
                  {puzzle.cargo
                    .filter((_, i) => passengers & (1 << i))
                    .map((cargo) => (
                      <CargoIcon key={cargo} cargo={cargo} />
                    ))}
                </div>
                <svg viewBox="0 0 90 60" aria-hidden="true">
                  <circle cx="22" cy="18" r="7" fill="currentColor" />
                  <path d="M13 38V31q9-11 18 0v7M4 39h82L74 54H17Z" fill="currentColor" />
                  <path d="m32 22 26 32" stroke="currentColor" strokeWidth="4" />
                  <path d="M23 45h43" stroke="var(--surface)" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
          <div className="rg-rules">
            {puzzle.conflicts.length ? <p>{t('riverCargoKeepApart')}</p> : null}
            <div className="rg-pairs">
              {puzzle.conflicts.map(([a, b]) => (
                <span
                  key={a + ':' + b}
                  className={notice && conflict?.[0] === a && conflict[1] === b ? 'is-warning' : ''}
                  aria-label={t('riverCargoUnsafe', {
                    a: t(`riverCargo_${puzzle.cargo[a]!}`),
                    b: t(`riverCargo_${puzzle.cargo[b]!}`),
                  })}
                >
                  <CargoIcon cargo={puzzle.cargo[a]!} />
                  <span aria-hidden="true">×</span>
                  <CargoIcon cargo={puzzle.cargo[b]!} />
                </span>
              ))}
            </div>
            {puzzle.crew?.length ? (
              <p className="rg-extra-rule">{t('riverCargoNeedCrew', { cargo: crewNames })}</p>
            ) : null}
            {puzzle.boatConflicts?.map(([a, b]) => (
              <p className="rg-extra-rule" key={a + ':' + b}>
                {t('riverCargoBoatConflict', {
                  a: t(`riverCargo_${puzzle.cargo[a]!}`),
                  b: t(`riverCargo_${puzzle.cargo[b]!}`),
                })}
              </p>
            ))}
          </div>
        </div>
        <div className="rg-controls">
          <p className="rg-status" role="status">
            {notice ||
              (hint !== null
                ? hint === 0
                  ? t('riverCargoHintEmpty')
                  : t('riverCargoHintLoad', {
                      cargo: puzzle.cargo
                        .filter((_, i) => hint & (1 << i))
                        .map((cargo) => t(`riverCargo_${cargo}`))
                        .join(' / '),
                    })
                : t('riverCargoSelect'))}
          </p>
          <div className="action-bar rg-actions">
            <button
              type="button"
              className="btn btn-primary rg-cross"
              disabled={!!playback}
              onClick={cross}
            >
              {t('riverCargoCross')} <span aria-hidden="true">{session.boat ? '←' : '→'}</span>
            </button>

            <button
              type="button"
              className="action-btn"
              disabled={!!playback || !session.actions.length}
              onClick={undo}
            >
              <span className="action-icon">
                <IconUndo />
              </span>
              {t('undo')}
            </button>
            <button
              type="button"
              className="action-btn"
              disabled={!!playback}
              onClick={() => {
                setNotice('');
                const route = solve(puzzle, session.mask, session.boat);
                setHint(route?.[0] ?? null);
                if (!route?.length) setNotice(t('riverCargoNoRoute'));
              }}
            >
              <span className="action-icon">
                <IconHint />
              </span>
              {t('hint')}
            </button>
          </div>
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={playback?.before ?? session}
        onRetry={() => reset(restartCurrent)}
        onNewBoard={() => reset(startNewBoard)}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={() => reset(restartCurrent)}
        newBoard={{ label: t('riverCargoNextPuzzle'), start: () => reset(startNewBoard) }}
      />
    </div>
  );
}
