/**
 * The Box Regions game screen (docs/BOX_REGIONS_RULES.md §4, §6, §10).
 *
 * No clock on screen (§10): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * Two actions, both free and unlimited: Undo, because one stroke can take
 * several boxes away at once and drawing them back is real work (§6), and
 * Hint (§6). The keyboard reaches both — Ctrl/Cmd+Z and H (issue #93) — as
 * adapters over the same handlers the buttons call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { RestartDialog } from '@/ui/components/RestartDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import { canUndo, UNASSIGNED, type Hint } from '../../game';
import { useBoxRegions } from '../../state/GameContext';
import { BoxRegionsBoard } from '../components/BoxRegionsBoard';
import { BoxRegionsResultOverlay } from '../components/BoxRegionsResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

export function BoxRegionsGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    draw,
    tap,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startDifficulty,
    startNewBoard,
  } = useBoxRegions();
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

  const onDraw = useCallback(
    (from: number, to: number): boolean => {
      if (!draw(from, to)) return false;
      setHint(null);
      sounds.select();
      void haptics.tap();
      return true;
    },
    [draw],
  );

  const onTap = useCallback(
    (index: number) => {
      // Read before the tap: a box going away sounds like taking back.
      const removing = session !== null && session.assignment[index] !== UNASSIGNED;
      if (!tap(index)) return;
      setHint(null);
      if (removing) sounds.undo();
      else sounds.select();
      void haptics.tap();
    },
    [session, tap],
  );

  const onUndo = useCallback(() => {
    if (!applyUndo()) return;
    setHint(null);
    sounds.undo();
  }, [applyUndo]);

  /** The hint points; it never writes to the board for the player (§6). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('boxRegionsHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    if (next.kind === 'wrong') {
      showToast(t('boxRegionsHintWrong'));
      return;
    }
    const technique = next.step.technique;
    showToast(
      t(
        technique === 'forced-cell'
          ? 'boxRegionsHintForced'
          : technique === 'sole-placement'
            ? 'boxRegionsHintSole'
            : 'boxRegionsHintCommon',
      ),
    );
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93): H asks for
     the hint and Ctrl/Cmd+Z undoes, the same one-shot actions the two buttons
     trigger, so key repeat is ignored for both. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
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
              {session.mode === 'daily'
                ? t('modeDaily')
                : t(`boxRegionsDifficulty_${session.difficulty}`)}
            </span>
            <span className="br-size-tag">
              {t('boxRegionsBoardNote', { width: session.width, height: session.height })}
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

        <div className="br-board-scroll">
          <BoxRegionsBoard
            session={session}
            hint={hint}
            onDraw={onDraw}
            onTap={onTap}
            solved={session.status === 'solved'}
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
            onClick={onUndo}
            disabled={!canUndo(session)}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
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

      <BoxRegionsResultOverlay
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
            ? { label: t('boxRegionsNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
