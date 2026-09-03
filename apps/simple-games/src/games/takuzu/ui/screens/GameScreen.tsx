/**
 * The Takuzu game screen (docs/TAKUZU_RULES.md §4, §8, §10).
 *
 * No clock on screen (§10): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * One action, free and unlimited: Hint (§8). There is no undo button, because
 * a cell cycles empty → 0 → 1 → empty under the same tap that filled it —
 * an undo would be a second button doing what the first one already does.
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
import { freeTierForSize, type Hint } from '../../game';
import { useTakuzu } from '../../state/GameContext';
import { TakuzuBoard } from '../components/TakuzuBoard';
import { TakuzuResultOverlay } from '../components/TakuzuResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

export function TakuzuGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    tap,
    takeHint,
    goHome,
    restartCurrent,
    startNextLevel,
    startFree,
  } = useTakuzu();
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

  const onTap = useCallback(
    (index: number) => {
      setHint(null);
      if (!tap(index)) return;
      sounds.select();
      void haptics.tap();
    },
    [tap],
  );

  /** The hint points; it never writes the digit for the player (§8). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('takuzuHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    showToast(t(next.kind === 'step' ? 'takuzuHintFound' : 'takuzuHintBroken'));
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
                : session.mode === 'free'
                  ? t('freePlay')
                  : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="takuzu-size-tag">{t('takuzuSizeLabel', { n: session.size })}</span>
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

        <div className="takuzu-board-scroll">
          <TakuzuBoard session={session} hint={hint} onTap={onTap} />
        </div>

        {toast ? (
          <div className="toast" role="status">
            {toast}
          </div>
        ) : null}

        <div className="action-bar">
          <button type="button" className="action-btn" onClick={onHint}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <TakuzuResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onNewFree={() => startFree(freeTierForSize(session.size))}
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
