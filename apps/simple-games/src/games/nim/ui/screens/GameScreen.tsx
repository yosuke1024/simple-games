import { useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { sounds } from '@/services/sound';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { isCpuTurn } from '../../game';
import { useNim } from '../../state/GameContext';
import { ResultOverlay } from '../components/ResultOverlay';
export function GameScreen() {
  const { t } = useSettings();
  const { session, playMove, applyUndo, goHome, startNewGame, paused, pauseGame, resumeGame } =
    useNim();
  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [row, setRow] = useState<number | null>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    setRow(null);
    setCount(1);
  }, [session?.moves.length, session?.seed]);
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
  const take = () => {
    if (row !== null && playMove({ row, count })) {
      setRow(null);
      sounds.select();
    }
  };
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
          <div className="game-title">
            {t('nimName')}
            <span className="nim-mode">{t(`nimMode_${session.mode}`)}</span>
          </div>
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
        <p className="nim-turn" role="status">
          {paused ? t('nimPaused') : cpu ? t('nimCpuTurn') : t('nimYourTurn')}
        </p>
        <div className="nim-heaps" aria-label={t('nimName')}>
          {session.heaps.map((stones, index) => (
            <button
              type="button"
              key={index}
              className={`nim-heap ${row === index ? 'nim-selected' : ''}`}
              disabled={blocked || !stones}
              aria-pressed={row === index}
              aria-label={t('nimRow', { row: index + 1, count: stones })}
              onClick={() => {
                setRow(index);
                setCount(1);
              }}
            >
              <span className="nim-row-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="nim-stones" aria-hidden="true">
                {stones ? (
                  Array.from({ length: stones }, (_, i) => (
                    <span
                      key={i}
                      className={`nim-stone ${row === index && i >= stones - count ? 'nim-remove' : ''}`}
                    />
                  ))
                ) : (
                  <span className="nim-empty">—</span>
                )}
              </span>
              <span className="nim-total" aria-hidden="true">
                {stones}
              </span>
            </button>
          ))}
        </div>
        <p className="nim-last" aria-live="polite">
          {last ? t('nimLastMove', { row: last.row + 1, count: last.count }) : t('nimGoal')}
        </p>
        {paused ? (
          <button type="button" className="btn btn-primary" onClick={resumeGame}>
            {t('resume')}
          </button>
        ) : (
          <div className="nim-controls">
            <p className="nim-instruction">
              {row === null ? t('nimChooseRow') : t('nimChooseCount')}
            </p>
            <div className="nim-counts" role="group" aria-label={t('nimChooseCount')}>
              {Array.from({ length: row === null ? 0 : session.heaps[row]! }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  disabled={blocked}
                  className={`nim-count ${count === i + 1 ? 'nim-count-selected' : ''}`}
                  aria-pressed={count === i + 1}
                  onClick={() => setCount(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={blocked || row === null}
              onClick={take}
            >
              {t('nimTake', { count })}
            </button>
          </div>
        )}
        <div className="nim-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!session.moves.length}
            onClick={onUndo}
          >
            <IconUndo />
            {t('undo')}
          </button>
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
