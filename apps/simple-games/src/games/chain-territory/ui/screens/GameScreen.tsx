import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { type Cell } from '../../game';
import { useChainTerritory } from '../../state/GameContext';
import { Board } from '../components/Board';
import { ResultOverlay } from '../components/ResultOverlay';
function Cascade({ waves, durationMs }: { waves: Cell[][]; durationMs: number }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((n) => Math.min(n + 1, waves.length - 1)),
      durationMs / Math.max(1, waves.length),
    );
    return () => window.clearInterval(timer);
  }, [waves, durationMs]);
  return (
    <div className="ct-cascade" aria-hidden="true" inert>
      <Board board={waves[step] ?? waves[0]!} blocked onPlay={() => {}} lastCell={null} />
    </div>
  );
}
export function GameScreen() {
  const { t } = useSettings();
  const { session, playback, play, applyUndo, goHome, restartCurrent, startNewBoard, setPaused } =
    useChainTerritory();
  const [confirmRestart, setConfirmRestart] = useState(false);
  useEffect(() => {
    setPaused(confirmRestart);
    return () => setPaused(false);
  }, [confirmRestart, setPaused]);
  const undo = () => {
    if (applyUndo()) sounds.undo();
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
  const shown = playback?.before ?? session;
  const own = shown.board.reduce((sum, c) => sum + (c.owner === 1 ? c.count : 0), 0);
  const cpu = shown.board.reduce((sum, c) => sum + (c.owner === 2 ? c.count : 0), 0);
  return (
    <div className="screen game-screen ct-screen">
      <div className="game-content" inert={over || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t(`chainTerritoryMode_${session.mode}`)}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>
        <div className="ct-body">
          <div className="ct-scoreboard">
            <span className={shown.turn === 1 ? 'is-turn' : ''}>
              <i className="ct-you-mark" />
              {t('chainTerritoryYou')} <strong>{own}</strong>
            </span>
            <span className={shown.turn === 2 ? 'is-turn' : ''}>
              <i className="ct-cpu-mark" />
              {t('chainTerritoryCpu')} <strong>{cpu}</strong>
            </span>
          </div>
          <div className="ct-board-wrap">
            <Board
              board={session.board}
              blocked={!!playback || session.turn !== 1}
              lastCell={session.lastCell}
              onPlay={(cell) => {
                if (play(cell)) sounds.select();
              }}
            />
            {playback ? (
              <Cascade
                key={session.actions.length}
                waves={playback.after.waves}
                durationMs={playback.durationMs}
              />
            ) : null}
          </div>
          <p className="ct-status" role="status">
            {t(
              playback && playback.after.waves.length > 1
                ? 'chainTerritoryChain'
                : session.turn === 2
                  ? 'chainTerritoryThinking'
                  : 'chainTerritoryTurn',
            )}
          </p>
          <p className="ct-legend">{t('chainTerritoryCapacity')}</p>
          <div className="action-bar ct-actions">
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
          </div>
        </div>
      </div>
      <BannerSlot />
      <ResultOverlay
        session={playback?.before ?? session}
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
