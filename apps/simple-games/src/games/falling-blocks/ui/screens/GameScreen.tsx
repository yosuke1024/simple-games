import { useLayoutEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { useGameKeys } from '@/ui/useGameKeys';
import { level, pieceAt, type Action } from '../../game';
import { useFallingBlocks } from '../../state/GameContext';
import { Board, PiecePreview } from '../components/Board';
import { Controls } from '../components/Controls';
import { ResultOverlay } from '../components/ResultOverlay';
const STATES = {
  ready: 'fallingBlocksReady',
  running: 'fallingBlocksRunning',
  paused: 'fallingBlocksPaused',
  over: 'fallingBlocksOver',
} as const;
export function GameScreen() {
  const { t } = useSettings();
  const { session, play, togglePause, pauseGame, retry, newGame, goHome } = useFallingBlocks();
  const [restart, setRestart] = useState(false);
  const over = session?.status === 'over';
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previousStatusRef = useRef(session?.status);
  useLayoutEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = session?.status;
    if (previous === 'over' && session?.status === 'ready') toggleRef.current?.focus();
  }, [session?.status]);
  useGameKeys(
    (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (event.key.toLowerCase() === 'p') {
        if (!event.repeat) togglePause();
        return true;
      }
      if (
        event.key === ' ' &&
        event.target instanceof Element &&
        event.target.closest('button, a, [role="button"]')
      )
        return false;
      const actions: Record<string, Action> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'rotate',
        ArrowDown: 'softDrop',
        ' ': 'hardDrop',
      };
      const action = actions[event.key];
      if (!action) return false;
      if (!event.repeat || action === 'left' || action === 'right' || action === 'softDrop')
        play(action);
      return true;
    },
    !!session && !over && !restart,
  );
  if (!session) return null;
  return (
    <div className="screen game-screen fb-screen">
      <div className="game-content" inert={over || restart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="fb-top-score">
            <span>{t('score')}</span>
            <strong>{session.score}</strong>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => {
              pauseGame();
              setRestart(true);
            }}
          >
            <IconRetry />
          </button>
        </header>
        <div className="fb-stage">
          <Board session={session} />
          <aside className="fb-sidebar">
            <div>
              <span>{t('fallingBlocksNext')}</span>
              <PiecePreview kind={pieceAt(session.seed, session.pieceIndex + 1)} />
            </div>
            <dl>
              <div>
                <dt>{t('fallingBlocksLines')}</dt>
                <dd>{session.lines}</dd>
              </div>
              <div>
                <dt>{t('fallingBlocksLevel')}</dt>
                <dd>{level(session.lines)}</dd>
              </div>
            </dl>
          </aside>
        </div>
        <div className="fb-runbar">
          <span role="status">{t(STATES[session.status])}</span>
          <button
            type="button"
            className={`btn ${session.status === 'running' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={togglePause}
            ref={toggleRef}
            disabled={over}
          >
            {session.status === 'running'
              ? t('fallingBlocksPause')
              : session.status === 'ready'
                ? t('startPlaying')
                : t('resume')}
          </button>
        </div>
        <Controls enabled={session.status === 'running' && !restart} play={play} />
        <p className="fb-keyboard">{t('fallingBlocksKeyboard')}</p>
        <span className="visually-hidden" aria-live="polite">
          {t('fallingBlocksLines')}: {session.lines}.
        </span>
      </div>
      <BannerSlot />
      <RestartDialog
        open={restart}
        onClose={() => setRestart(false)}
        onRetry={retry}
        newBoard={{ label: t('newGame'), start: newGame }}
      />
      <ResultOverlay onNewBoard={newGame} />
    </div>
  );
}
