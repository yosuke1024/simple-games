/**
 * The Minesweeper game screen (docs/MINESWEEPER_RULES.md §3, §6, §7, §12).
 *
 * No clock on screen (§6): the elapsed time is recorded and shown on the result
 * card and in the statistics, so nothing here pushes the player to hurry. What
 * is on screen is board information — how many mines are still unaccounted for.
 *
 * Two actions, both free and unlimited: flag mode, so a long press is never the
 * only way to plant a flag (§3), and Hint (§7). There is no undo button,
 * because there is no undo (§7) — the retry on the result card is the answer,
 * and it costs nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { useGameKeys } from '@/ui/useGameKeys';
import { hasStarted, remainingMines, type SafeCell } from '../../game';
import { useMinesweeper } from '../../state/GameContext';
import { MinesBoard } from '../components/MinesBoard';
import { MinesResultOverlay } from '../components/MinesResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

export function MinesGameScreen() {
  const {
    session,
    prefs,
    lastResult,
    sessionEpoch,
    tap,
    flag,
    chord,
    takeHint,
    setFlagMode,
    goHome,
    restartCurrent,
    startDifficulty,
  } = useMinesweeper();
  const { t } = useSettings();

  const [hint, setHint] = useState<SafeCell | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const toastTimeout = useTransientTimeout();

  // A new board is a clean slate.
  useEffect(() => {
    setHint(null);
    setToast(null);
  }, [sessionEpoch]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      // Re-showing restarts the clock; unmount cancels it (useTransientTimeout).
      toastTimeout(() => setToast(null), TOAST_MS);
    },
    [toastTimeout],
  );

  const onOpen = useCallback(
    (index: number) => {
      setHint(null);
      if (!tap(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [tap],
  );

  const onFlag = useCallback(
    (index: number) => {
      setHint(null);
      if (!flag(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [flag],
  );

  const onChord = useCallback(
    (index: number) => {
      setHint(null);
      if (!chord(index)) return;
      sounds.match();
      void haptics.match();
    },
    [chord],
  );

  /** Turning flag mode on says what it changed; turning it off needs no words. */
  const onToggleFlagMode = useCallback(() => {
    const next = !prefs.flagMode;
    setFlagMode(next);
    if (next) showToast(t('minesFlagModeNote'));
    else setToast(null);
  }, [prefs.flagMode, setFlagMode, showToast, t]);

  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('minesHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    showToast(t('minesHintFound'));
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the tap handler above (issue #93): H asks for
     the hint, the same one-shot action the button triggers, so key repeat is
     ignored. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'h' || event.key === 'H') {
      if (!event.repeat) onHint();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t(`minesDifficulty_${session.difficulty}`)}
            </span>
            <span className="mines-counter">
              <span className="mines-counter-glyph" aria-hidden="true">
                ⚑
              </span>
              <span className="visually-hidden">{t('minesMinesLeft')}: </span>
              {remainingMines(session.board)}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('tryAgain')}
            onClick={() => setConfirmRestart(true)}
          >
            <IconRetry />
          </button>
        </header>

        <div className="mines-board-scroll">
          <MinesBoard
            board={session.board}
            hint={hint}
            flagMode={prefs.flagMode}
            onOpen={onOpen}
            onFlag={onFlag}
            onChord={onChord}
          />
          {hasStarted(session) ? null : <p className="mines-start-hint">{t('minesTapToStart')}</p>}
        </div>

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}

        <div className="action-bar">
          <button
            type="button"
            className="action-btn"
            aria-pressed={prefs.flagMode}
            onClick={onToggleFlagMode}
          >
            <span className="action-icon" aria-hidden="true">
              ⚑
            </span>
            {t('minesFlagMode')}
          </button>
          <button type="button" className="action-btn" onClick={onHint}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <MinesResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNewBoard={() => startDifficulty(session.difficulty)}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmRestart}
        title={t('tryAgain')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartCurrent();
        }}
      />
    </div>
  );
}
