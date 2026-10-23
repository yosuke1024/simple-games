import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { haptics } from '@/services/haptics';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo, IconHint } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { adjacent, solution, destinations, type Direction } from '../../game';
import { useMazeEscape } from '../../state/GameContext';
import { Board } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, stats, play, applyUndo, goHome, restartCurrent, startNewBoard, setPaused } =
    useMazeEscape();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const onPlay = useCallback(
    (target: number) => {
      if (play(target)) {
        setHint(null);
        sounds.select();
        void haptics.tap();
      }
    },
    [play],
  );
  const onDirection = (direction: Direction) => {
    if (session) {
      const target = adjacent(session.size, session.position, direction);
      if (target !== null) onPlay(target);
    }
  };
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      setHint(null);
    }
  }, [applyUndo]);
  const onRetry = () => {
    setHint(null);
    restartCurrent();
  };
  const onNewBoard = () => {
    setHint(null);
    startNewBoard();
  };
  useGameKeys(
    (event) => {
      if (isUndoKey(event)) {
        if (!event.repeat) onUndo();
        return true;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      const mapping: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowRight: 'right',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        w: 'up',
        d: 'right',
        s: 'down',
        a: 'left',
      };
      const direction = mapping[event.key];
      if (direction) {
        onDirection(direction);
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart,
  );
  if (!session) return null;
  const over = session.status === 'over';
  const available = destinations(session.board, session.size, session.position);
  const controls = [
    { direction: 'up' as const, label: t('mazeEscapeUp'), symbol: '↑' },
    { direction: 'left' as const, label: t('mazeEscapeLeft'), symbol: '←' },
    { direction: 'down' as const, label: t('mazeEscapeDown'), symbol: '↓' },
    { direction: 'right' as const, label: t('mazeEscapeRight'), symbol: '→' },
  ];
  return (
    <div className="screen game-screen me-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">
            {session.size} × {session.size}
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
        <div className="me-body">
          <div className="me-metrics">
            <span>
              {t('movesLabel')} <strong>{session.history.length}</strong>
            </span>
            <span>{t('mazeEscapeGoal')}</span>
          </div>
          <Board session={session} hint={hint} onPlay={onPlay} onDirection={onDirection} />
          <p className="me-position" role="status" aria-atomic="true">
            {t('mazeEscapePosition', {
              row: Math.floor(session.position / session.size) + 1,
              col: (session.position % session.size) + 1,
            })}
            {hint !== null ? (
              <span className="me-hint-note">
                {t('mazeEscapeHintNote', {
                  row: Math.floor(hint / session.size) + 1,
                  col: (hint % session.size) + 1,
                })}
              </span>
            ) : null}
          </p>
          <div className="me-directions" role="group" aria-label={t('mazeEscapeControls')}>
            {controls.map(({ direction, label, symbol }) => (
              <button
                key={direction}
                type="button"
                className={`me-direction me-${direction}`}
                aria-label={label}
                aria-disabled={
                  !available.includes(adjacent(session.size, session.position, direction) ?? -1)
                }
                onClick={() => onDirection(direction)}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="action-bar me-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={!session.history.length}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setHint(solution(session)[0] ?? null)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>
        <BannerSlot />
      </div>
      <ResultOverlay
        session={session}
        best={stats.boards[session.size].best}
        onUndo={onUndo}
        onRetry={onRetry}
        onNewBoard={onNewBoard}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
        newBoard={{ label: t('newGame'), start: onNewBoard }}
      />
    </div>
  );
}
