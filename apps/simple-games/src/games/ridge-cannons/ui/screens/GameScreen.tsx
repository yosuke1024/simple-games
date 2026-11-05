import { RidgeCannonsSurface } from '../components/RidgeCannonsSurface';
import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { useRidgeCannons } from '../../state/GameContext';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const {
    session: committed,
    playback,
    play,
    goHome,
    restartCurrent,
    startNewBoard,
    setPaused,
  } = useRidgeCannons();
  const [confirmRestart, setConfirmRestart] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const session = playback?.before ?? committed;
  if (!session) return null;
  const round = Math.min(12, Math.floor(session.actions.length / 2) + 1);
  const over = session.status !== 'playing',
    ready = session.phase === 'player' && !over && !playback;
  return (
    <div className="screen game-screen rc-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('ridgeCannonsRound', { n: round })}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <RidgeCannonsSurface session={session} playback={playback} ready={ready} play={play} />
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
