import { useCallback, useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { haptics } from '@/services/haptics';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { encodeMove, topDisk } from '../../game';
import { useHanoiTowers } from '../../state/GameContext';
import { Board } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, stats, play, applyUndo, goHome, restartCurrent, setPaused } = useHanoiTowers();
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const onPeg = useCallback(
    (peg: number) => {
      if (!session || session.status !== 'playing' || confirmRestart) return;
      setInvalid(false);
      if (selected === peg) {
        setSelected(null);
        return;
      }
      if (selected === null) {
        if (topDisk(session.board, peg) >= 0) setSelected(peg);
        return;
      }
      if (play(encodeMove(selected, peg))) {
        setSelected(null);
        sounds.select();
        void haptics.tap();
      } else setInvalid(true);
    },
    [session, confirmRestart, selected, play],
  );
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      setSelected(null);
      setInvalid(false);
    }
  }, [applyUndo]);
  const onRetry = () => {
    setSelected(null);
    setInvalid(false);
    restartCurrent();
  };
  useGameKeys(
    (event) => {
      if (isUndoKey(event)) {
        if (!event.repeat) onUndo();
        return true;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return false;
      if (['1', '2', '3'].includes(event.key)) {
        if (!event.repeat) onPeg(Number(event.key) - 1);
        return true;
      }
      if (event.key === 'Escape' && selected !== null) {
        setSelected(null);
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart,
  );
  if (!session) return null;
  const over = session.status === 'over';
  return (
    <div className="screen game-screen ht-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('hanoiTowersDisks', { count: session.size })}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div className="ht-body">
          <div className="ht-metrics">
            <span className="ht-move-count">
              <span>{t('movesLabel')}</span> <strong>{session.history.length}</strong>
            </span>
            <span className="ht-reference">
              {t('hanoiTowersMinimum', { count: 2 ** session.size - 1 })}
            </span>
          </div>
          <Board session={session} selected={selected} onPeg={onPeg} />
          <p className="ht-instruction" role="status" aria-atomic="true">
            {invalid
              ? t('hanoiTowersInvalid')
              : selected === null
                ? t('hanoiTowersSelect')
                : t('hanoiTowersPlace', { peg: selected + 1 })}
          </p>
        </div>
        <div className="action-bar ht-actions">
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
        </div>
        <BannerSlot />
      </div>
      <ResultOverlay
        session={session}
        best={stats.boards[session.size].best}
        onUndo={onUndo}
        onRetry={onRetry}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={onRetry}
      />
    </div>
  );
}
