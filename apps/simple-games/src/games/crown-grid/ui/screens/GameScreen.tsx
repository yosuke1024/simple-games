/**
 * The Crown Grid game screen (docs/CROWN_GRID_RULES.md §4, §6, §10).
 *
 * No clock on screen (§10): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * One action, free and unlimited: Hint (§6) — the keyboard reaches it too, H
 * (issue #93). There is no undo button, because a cell cycles empty → × →
 * crown → empty under the same tap that filled it, and a stroke only ever
 * adds ×s that same tap takes off (§14).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { useGameKeys } from '@/ui/useGameKeys';
import type { Hint } from '../../game';
import { useCrownGrid } from '../../state/GameContext';
import { CrownGridBoard } from '../components/CrownGridBoard';
import { CrownGridResultOverlay } from '../components/CrownGridResultOverlay';
import { DIFFICULTY_KEY } from '../difficultyKey';
import { hintMessageKey } from '../hintMessage';

/** Long enough to read a full sentence — including the longer ones that now
    name the deduction (§6) — twice, in a second language. */
const TOAST_MS = 8000;

export function CrownGridGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    tap,
    markCross,
    takeHint,
    goHome,
    restartCurrent,
    startDifficulty,
    startNewBoard,
  } = useCrownGrid();
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

  /* One drag stroke reports the cells it has just crossed; the game writes ×
     on the empty ones (§4). Feedback is per batch rather than per cell: a fast
     finger crossing three cells in one frame is one event to the player. */
  const onStroke = useCallback(
    (indices: readonly number[]) => {
      setHint(null);
      if (!markCross(indices)) return;
      sounds.select();
      void haptics.tap();
    },
    [markCross],
  );

  /** The hint points; it never writes a mark for the player (§6). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null || session === null) {
      showToast(t('crownGridHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    showToast(t(hintMessageKey(next, session.size)));
  }, [session, showToast, t, takeHint]);

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
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-mode">
              {session.mode === 'daily' ? t('modeDaily') : t(DIFFICULTY_KEY[session.difficulty])}
            </span>
            <span className="cg-size-tag">{t('crownGridBoardNote', { size: session.size })}</span>
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

        <div className="cg-board-scroll">
          <CrownGridBoard
            session={session}
            hint={hint}
            solved={session.status === 'solved'}
            onTap={onTap}
            onStroke={onStroke}
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

      <CrownGridResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNewBoard={() => startDifficulty(session.difficulty)}
        onHome={goHome}
      />

      <RestartDialog
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        onRetry={restartCurrent}
        newBoard={
          session.mode === 'difficulty'
            ? { label: t('crownGridNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
