import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { isCpuTurn } from '../../game';
import { useNim } from '../../state/GameContext';
import { NimPlaySurface } from '../components/NimPlaySurface';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playMove, applyUndo, goHome, startNewGame, paused, pauseGame, resumeGame } =
    useNim();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const onUndo = () => {
    applyUndo();
    sounds.undo();
  };
  useGameKeys(
    (event) => {
      if (!isUndoKey(event)) return false;
      if (!event.repeat) onUndo();
      return true;
    },
    !!session && session.status === 'playing' && !confirmNewGame && !paused,
  );
  if (!session) return null;
  const over = session.status !== 'playing',
    cpu = isCpuTurn(session),
    blocked = over || cpu || paused;
  const last = session.moves[session.moves.length - 1];
  return (
    <div
      className="screen game-screen nim-screen"
      onKeyDownCapture={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
      }}
    >
      <div className="game-content" inert={confirmNewGame || over}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-title">{t('nimName')}</div>
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
        <div className="nim-play-area">
          <div className="nim-meta">
            <span className="nim-mode">{t(`nimMode_${session.mode}`)}</span>
            <p className="nim-turn" role="status">
              {paused ? t('nimPaused') : cpu ? t('nimCpuTurn') : t('nimYourTurn')}
            </p>
          </div>
          <NimPlaySurface
            heaps={session.heaps}
            last={last ?? null}
            positionKey={`${session.seed}:${session.moves.length}`}
            blocked={blocked}
            onTake={(move) => {
              if (playMove(move)) sounds.select();
            }}
            onUndo={onUndo}
            canUndo={session.moves.length > 0}
            paused={paused}
            onResume={resumeGame}
          />
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
        onUndo={onUndo}
        onNewGame={() => startNewGame(session.mode)}
        onHome={goHome}
      />
    </div>
  );
}
