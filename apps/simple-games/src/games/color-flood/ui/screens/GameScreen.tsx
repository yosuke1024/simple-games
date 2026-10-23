import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { haptics } from '@/services/haptics';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { region } from '../../game';
import { useColorFlood } from '../../state/GameContext';
import { Board } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, stats, play, applyUndo, goHome, restartCurrent, startNewBoard } =
    useColorFlood();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  const boardElement = useRef<HTMLDivElement>(null);
  const refocus = useRef(true);
  useLayoutEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected && !active.matches(':disabled'))
      return;
    boardElement.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus({ preventScroll: true });
  });
  const onPlay = useCallback(
    (action: number) => {
      if (!play(action)) return;
      setHint(null);
      refocus.current = true;
      sounds.select();
      void haptics.tap();
    },
    [play],
  );
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      setHint(null);
      refocus.current = true;
    }
  }, [applyUndo]);
  const onRetry = () => {
    setHint(null);
    refocus.current = true;
    restartCurrent();
  };
  const onNewBoard = () => {
    setHint(null);
    refocus.current = true;
    startNewBoard();
  };
  const onKey = (event: KeyboardEvent): boolean => {
    if (isUndoKey(event)) {
      if (!event.repeat) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (/^[1-6]$/.test(event.key)) {
      if (!event.repeat) onPlay(Number(event.key) - 1);
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session?.status === 'playing' && !confirmRestart);
  if (!session) return null;
  const over = session.status === 'over';
  return (
    <div className="screen game-screen">
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
        <div className="cf-body" ref={boardElement}>
          <div className="cf-metrics">
            <span>
              {t('movesLabel')} <strong>{session.history.length}</strong>
            </span>
            <span>
              {t('colorFloodStatus', {
                count: region(session.board, session.size).length,
                total: session.board.length,
              })}
            </span>
          </div>
          <Board session={session} onPlay={onPlay} hint={hint} />
        </div>
        <div className="action-bar cf-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onUndo}
            disabled={session.history.length === 0}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
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
