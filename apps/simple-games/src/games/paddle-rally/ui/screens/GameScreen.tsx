import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { usePaddleRally } from '../../state/GameContext';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const {
    session,
    updatePaddle,
    advanceFrame,
    serveBall,
    goHome,
    startNewGame,
    paused,
    pauseGame,
    resumeGame,
  } = usePaddleRally();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const directionRef = useRef(0);
  const pointerRef = useRef<number | null>(null);
  const running = !!session && session.status === 'playing' && !paused && !confirmNewGame;
  useGameKeys((event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
      directionRef.current = -1;
      if (session?.serving) updatePaddle(session.player - 18);
      return true;
    }
    if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
      directionRef.current = 1;
      if (session?.serving) updatePaddle(session.player + 18);
      return true;
    }
    if (event.key.toLowerCase() === 'p') {
      if (!event.repeat) pauseGame();
      return true;
    }
    if (event.key === ' ' && (event.target as HTMLElement)?.tagName !== 'BUTTON') {
      if (!event.repeat) serveBall();
      return true;
    }
    return false;
  }, running && !confirmNewGame);
  useEffect(() => {
    const release = () => {
      directionRef.current = 0;
    };
    window.addEventListener('keyup', release);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('keyup', release);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      release();
    };
  }, []);
  useEffect(() => {
    if (!running || session?.serving) {
      directionRef.current = 0;
      return;
    }
    let frame = 0,
      previous = 0;
    const tick = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 0;
      previous = now;
      if (dt) advanceFrame(dt, directionRef.current);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      directionRef.current = 0;
    };
  }, [running, session?.serving, advanceFrame]);
  if (!session) return null;
  const over = session.status !== 'playing';
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!running || pointerRef.current !== event.pointerId) return;
    const box = event.currentTarget.getBoundingClientRect();
    updatePaddle(((event.clientX - box.left) / box.width) * 320);
  };
  const releasePointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div className="screen game-screen paddle-rally-screen">
      <div className="game-content" inert={confirmNewGame || over}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-title">{t('paddleRallyName')}</div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => {
              pauseGame();
              setConfirmNewGame(true);
            }}
          >
            <IconRetry />
          </button>
        </header>
        <div className="pr-play-area">
          <div className="pr-score" aria-live="polite">
            <span>
              {t('paddleRallyYou')} <strong>{session.playerScore}</strong>
            </span>
            <span className="pr-target">{t('paddleRallyGoal')}</span>
            <span>
              <strong>{session.cpuScore}</strong> CPU
            </span>
          </div>
          <svg
            className="pr-board"
            viewBox="0 0 320 420"
            role="img"
            aria-label={t('paddleRallyBoard')}
            onPointerDown={(event) => {
              if (!running || pointerRef.current !== null) return;
              pointerRef.current = event.pointerId;
              event.currentTarget.setPointerCapture(event.pointerId);
              move(event);
            }}
            onPointerMove={move}
            onPointerUp={releasePointer}
            onPointerCancel={releasePointer}
          >
            <rect x="1" y="1" width="318" height="418" rx="13" className="pr-court" />
            <path d="M12 210 H308" className="pr-net" />
            <circle cx="160" cy="210" r="38" className="pr-ring" />
            <rect x={session.cpu - 34} y="24" width="68" height="8" rx="4" className="pr-cpu" />
            <rect
              x={session.player - 34}
              y="388"
              width="68"
              height="8"
              rx="4"
              className="pr-player"
            />
            <circle cx={session.x} cy={session.y} r="6" className="pr-ball" />
          </svg>
          <p className="pr-status" role="status">
            {paused
              ? t('paddleRallyPaused')
              : session.serving
                ? t('paddleRallyReady')
                : t('paddleRallyControls')}
          </p>
          <div className="pr-controls">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className="btn btn-secondary"
                disabled={!running}
                aria-label={t(dir === -1 ? 'paddleRallyLeft' : 'paddleRallyRight')}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  directionRef.current = dir;
                  updatePaddle(session.player + dir * 18);
                }}
                onPointerUp={() => {
                  directionRef.current = 0;
                }}
                onPointerCancel={() => {
                  directionRef.current = 0;
                }}
                onClick={(event) => {
                  if (event.detail === 0) updatePaddle(session.player + dir * 22);
                }}
              >
                {dir === -1 ? '←' : '→'}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-primary"
              onClick={paused ? resumeGame : session.serving ? serveBall : pauseGame}
            >
              {paused
                ? t('resume')
                : session.serving
                  ? t('paddleRallyServe')
                  : t('paddleRallyPause')}
            </button>
          </div>
        </div>
        <BannerSlot />
      </div>
      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => {
          setConfirmNewGame(false);
          resumeGame();
        }}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame(session.mode);
        }}
      />
      <ResultOverlay
        session={session}
        onNewGame={() => startNewGame(session.mode)}
        onHome={goHome}
      />
    </div>
  );
}
