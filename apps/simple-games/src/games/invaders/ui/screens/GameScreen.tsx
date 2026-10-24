import { useEffect } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { finished, STAGE_COUNT } from '../../game';
import { useInvaders } from '../../state/GameContext';
import { Board } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, stats, aim, steer, togglePause, pauseRun, startNewRun, advanceStage, goHome } =
    useInvaders();
  const active = !!session && !finished(session) && session.status !== 'between';
  useEffect(() => {
    if (!active) return;
    const release = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key) || ['KeyA', 'KeyD'].includes(event.code))
        steer(0);
    };
    window.addEventListener('keyup', release);
    return () => {
      window.removeEventListener('keyup', release);
      steer(0);
    };
  }, [active, steer]);
  useGameKeys(
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (
        event.key === 'ArrowLeft' ||
        event.code === 'KeyA' ||
        event.key === 'ArrowRight' ||
        event.code === 'KeyD'
      ) {
        const direction = event.key === 'ArrowLeft' || event.code === 'KeyA' ? -1 : 1;
        if (session?.status === 'running') steer(direction);
        else if (session) aim(session.playerX + direction * 12);
        return true;
      }
      if (event.key === ' ' || event.code === 'Space') {
        if (event.target instanceof Element && event.target.closest('button, a[href]'))
          return false;
        if (!event.repeat) togglePause();
        return true;
      }
      if (event.key === 'Escape' || event.code === 'KeyP') {
        if (!event.repeat) pauseRun();
        return true;
      }
      return false;
    },
    session !== null && !finished(session) && session.status !== 'between',
  );
  if (!session) return null;
  const over = finished(session);
  const running = session.status === 'running';
  const stopped = over || session.status === 'between';
  return (
    <div className="screen game-screen iv-screen" data-state={session.status}>
      <div className="game-content" inert={stopped}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <strong className="iv-title">{t('invadersName')}</strong>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('invadersRetry')}
            onClick={startNewRun}
          >
            <IconRetry />
          </button>
        </header>
        <div className="iv-metrics">
          <span className="iv-score">
            <small>{t('score')}</small>
            <strong>{session.score}</strong>
          </span>
          <span>
            <small>{t('invadersStage')}</small>
            <strong>
              {session.stage}
              <small> / {STAGE_COUNT}</small>
            </strong>
          </span>
          <span>
            <small>{t('invadersLives')}</small>
            <strong aria-label={t('invadersLivesLeft', { count: session.lives })}>
              {session.lives}
            </strong>
          </span>
        </div>
        <p className="iv-state" role="status">
          {session.status === 'paused'
            ? t('invadersPaused')
            : session.status === 'ready'
              ? t('invadersReady')
              : t('invadersAutoFire')}
        </p>
        <div className="iv-play-area">
          <div className="iv-field">
            <Board session={session} onAim={aim} />
          </div>
        </div>
        <div className="action-bar iv-controls">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              className={`action-btn iv-steer iv-steer-${direction === -1 ? 'left' : 'right'}`}
              aria-label={direction === -1 ? t('invadersLeft') : t('invadersRight')}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                steer(direction);
                if (!running) aim(session.playerX + direction * 18);
              }}
              onPointerUp={() => steer(0)}
              onPointerCancel={() => steer(0)}
              onLostPointerCapture={() => steer(0)}
              onClick={(event) => {
                if (event.detail === 0) aim(session.playerX + direction * 18);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d={direction === -1 ? 'M15 5 8 12l7 7' : 'm9 5 7 7-7 7'} />
              </svg>
            </button>
          ))}
          <button
            type="button"
            className="btn btn-primary iv-toggle"
            onClick={togglePause}
            aria-keyshortcuts="Space"
          >
            {running
              ? t('invadersPause')
              : session.status === 'paused'
                ? t('resume')
                : t('invadersStart')}
          </button>
        </div>
        <p className="iv-controls-note">{t('invadersControls')}</p>
        <BannerSlot />
      </div>
      <ResultOverlay
        session={session}
        best={stats.bestScore}
        onRetry={startNewRun}
        onNext={advanceStage}
        onHome={goHome}
      />
    </div>
  );
}
