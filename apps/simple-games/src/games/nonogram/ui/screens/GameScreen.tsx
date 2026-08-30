/**
 * The Nonogram game screen (docs/NONOGRAM_RULES.md §3, §7, §8).
 *
 * No clock on screen (§8): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * Two actions, both free and unlimited: X mode, so a long press is never the
 * only way to cross a cell (§3), and Hint (§7). There is no undo button,
 * because every mark already toggles off with the tap that put it down (§7).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { useGameKeys } from '@/ui/useGameKeys';
import type { Hint } from '../../game';
import { useNonogram } from '../../state/GameContext';
import { NonoBoard } from '../components/NonoBoard';
import { NonoResultOverlay } from '../components/NonoResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

export function NonoGameScreen() {
  const {
    session,
    prefs,
    lastResult,
    sessionEpoch,
    paint,
    cross,
    takeHint,
    setXMode,
    goHome,
    restartCurrent,
    startNextLevel,
  } = useNonogram();
  const { t } = useSettings();

  const [hint, setHint] = useState<Hint | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const toastTimeout = useTransientTimeout();

  // A new board is a clean slate.
  useEffect(() => {
    setHint(null);
    setToast(null);
  }, [sessionEpoch]);

  // Result feedback (sound / vibration) exactly once per transition.
  const previousStatus = useRef(session?.status ?? 'playing');
  useEffect(() => {
    const status = session?.status ?? 'playing';
    if (status === 'solved' && previousStatus.current === 'playing') {
      sounds.clear();
      void haptics.clear();
    }
    previousStatus.current = status;
  }, [session?.status]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      // Re-showing restarts the clock; unmount cancels it (useTransientTimeout).
      toastTimeout(() => setToast(null), TOAST_MS);
    },
    [toastTimeout],
  );

  const onPaint = useCallback(
    (index: number) => {
      setHint(null);
      if (!paint(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [paint],
  );

  const onCross = useCallback(
    (index: number) => {
      setHint(null);
      if (!cross(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [cross],
  );

  /** Turning X mode on says what it changed; turning it off needs no words. */
  const onToggleXMode = useCallback(() => {
    const next = !prefs.xMode;
    setXMode(next);
    if (next) showToast(t('nonoXModeNote'));
    else setToast(null);
  }, [prefs.xMode, setXMode, showToast, t]);

  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('nonoHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    showToast(t(next.kind === 'cell' ? 'nonoHintFound' : 'nonoHintBroken'));
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
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="nono-size-tag">{t('nonoSizeLabel', { n: session.size })}</span>
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

        <div className="nono-board-scroll">
          <NonoBoard
            session={session}
            hint={hint}
            xMode={prefs.xMode}
            onPaint={onPaint}
            onCross={onCross}
          />
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
            aria-pressed={prefs.xMode}
            onClick={onToggleXMode}
          >
            <span className="action-icon" aria-hidden="true">
              ×
            </span>
            {t('nonoXMode')}
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

      <NonoResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
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
