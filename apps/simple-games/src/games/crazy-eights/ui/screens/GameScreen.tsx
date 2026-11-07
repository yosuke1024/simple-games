import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useGameKeys } from '@/ui/useGameKeys';
import { useCrazyEights } from '../../state/GameContext';
import { project } from '../../game/view';
import { Table } from '../components/Table';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, goHome, restartCurrent, startNewBoard, setPaused } =
    useCrazyEights();
  const [confirmRestart, setConfirmRestart] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  useGameKeys(
    (event) => {
      if (event.key === 'Escape') {
        goHome();
        return true;
      }
      return false;
    },
    session?.status === 'playing' && !confirmRestart,
  );
  if (!session) return null;
  const over = session.status !== 'playing';
  return (
    <div className="screen game-screen ce-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('crazyEightsName')}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <Table
          view={project(session, 0)}
          canAct={!over && !playback && !confirmRestart}
          act={(action) => {
            if (play(action)) sounds.select();
          }}
        />
      </div>
      <BannerSlot />
      <ResultOverlay
        session={session}
        onRetry={restartCurrent}
        onNewBoard={startNewBoard}
        onHome={goHome}
      />
      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={restartCurrent}
        newBoard={{ label: t('newGame'), start: startNewBoard }}
      />
    </div>
  );
}
