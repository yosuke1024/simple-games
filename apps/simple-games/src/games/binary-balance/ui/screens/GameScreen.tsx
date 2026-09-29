/**
 * The Binary Balance game screen (docs/BINARY_BALANCE_RULES.md §4, §8, §10).
 *
 * No clock on screen (§10): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * One action, free and unlimited: Hint (§8) — the keyboard reaches it too, H
 * (§4). There is no undo button, because a cell cycles empty → sun → moon
 * → empty under the same tap that filled it (§8, §14).
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
import { useBinaryBalance } from '../../state/GameContext';
import { BinaryBalanceBoard } from '../components/BinaryBalanceBoard';
import { BinaryBalanceResultOverlay } from '../components/BinaryBalanceResultOverlay';
import { DIFFICULTY_KEY } from '../difficultyKey';
import { hintMessage } from '../hintMessage';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 8000;

export function BinaryBalanceGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    tap,
    takeHint,
    goHome,
    restartCurrent,
    startDifficulty,
  } = useBinaryBalance();
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

  /** The hint points; it never writes a mark for the player (§8). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null || session === null) {
      showToast(t('binaryBalanceHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    const message = hintMessage(next, session.links);
    showToast(
      t(message.key, {
        mark: message.mark === null ? '' : t(message.mark),
        other: message.other === null ? '' : t(message.other),
      }),
    );
  }, [session, showToast, t, takeHint]);

  /* Keyboard as an adapter over the button above (§4): H asks for the hint,
     the same one-shot action the button triggers, so key repeat is ignored. */
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
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily' ? t('modeDaily') : t(DIFFICULTY_KEY[session.difficulty])}
            </span>
            <span className="bn-size-tag">
              {t('binaryBalanceBoardNote', { size: session.size })}
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

        <div className="bn-board-scroll">
          <BinaryBalanceBoard
            session={session}
            hint={hint}
            solved={session.status === 'solved'}
            onTap={onTap}
          />
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

      <BinaryBalanceResultOverlay
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
