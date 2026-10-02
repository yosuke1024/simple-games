/**
 * The Number Path game screen (docs/NUMBER_PATH_RULES.md §4, §5, §8).
 *
 * No clock on screen (§8): the elapsed time is recorded and shown on the
 * result card and in the statistics, so nothing here pushes the player to
 * hurry.
 *
 * Two actions, both free and unlimited: Undo — one stroke, one tap, or one
 * cut of the path at a time (§5) — and Hint, which points at one cell and
 * never draws it (§5). The keyboard reaches everything the finger does (§4):
 * arrows extend from the end, Backspace steps back, Ctrl/Cmd+Z undoes, H asks
 * for the hint.
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
import { canUndo, DOWN, LEFT, RIGHT, UP, type Direction, type Hint } from '../../game';
import { useNumberPath } from '../../state/GameContext';
import { NumberPathBoard } from '../components/NumberPathBoard';
import { NumberPathResultOverlay } from '../components/NumberPathResultOverlay';

/** Long enough to read a full sentence twice, in a second language. */
const TOAST_MS = 5000;

/** Which way each arrow key extends the path (§4). */
const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: UP,
  ArrowRight: RIGHT,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
};

export function NumberPathGameScreen() {
  const {
    session,
    lastResult,
    sessionEpoch,
    trace,
    tapCell,
    step,
    backtrack,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startDifficulty,
    startNewBoard,
  } = useNumberPath();
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

  /** A stroke's cells, in order. The hint mark is spent by the first move. */
  const onTrace = useCallback(
    (cells: readonly number[], newStroke: boolean): boolean => {
      const change = trace(cells, newStroke);
      if (change === null) return false;
      setHint(null);
      // The path grew: `select`. It shrank — however it was drawn (§4, §11).
      if (change === 'shrank') sounds.undo();
      else sounds.select();
      return true;
    },
    [trace],
  );

  const onTap = useCallback(
    (index: number) => {
      const change = tapCell(index);
      if (change === null) return;
      setHint(null);
      if (change === 'shrank') sounds.undo();
      else sounds.select();
      void haptics.tap();
    },
    [tapCell],
  );

  const onStep = useCallback(
    (direction: Direction) => {
      const change = step(direction);
      if (change === null) return;
      setHint(null);
      if (change === 'shrank') sounds.undo();
      else sounds.select();
    },
    [step],
  );

  /** Backspace/Delete: the same truncation an arrow-back or a drag-back is (§4). */
  const onBacktrack = useCallback(() => {
    if (!backtrack()) return;
    setHint(null);
    sounds.undo();
  }, [backtrack]);

  const onUndo = useCallback(() => {
    setHint(null);
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  /** The hint points; it never draws the cell for the player (§5). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('numberPathHintNone'));
      return;
    }
    setHint(next);
    sounds.select();
    showToast(t(next.kind === 'next' ? 'numberPathHintNext' : 'numberPathHintBack'));
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the handlers above (issue #93): arrows step
     from the end, Backspace/Delete step back, Ctrl/Cmd+Z undoes, H asks for
     the hint. Every one of them calls the handler its own on-screen gesture
     calls, so nothing here is reachable by keyboard alone. State-changing
     keys ignore key repeat — a held arrow must not race the path across the
     board — and Backspace answers `true` even with nothing to take back, so
     the browser never treats it as "navigate back" mid-game. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const { key } = event;
    const direction = ARROWS[key];
    if (direction !== undefined) {
      if (!event.repeat) onStep(direction);
      return true;
    }
    if (key === 'Backspace' || key === 'Delete') {
      if (!event.repeat) onBacktrack();
      return true;
    }
    if (key === 'h' || key === 'H') {
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
                : t(`numberPathDifficulty_${session.difficulty}`)}
            </span>
            <span className="np-size-tag">
              {t('numberPathBoardNote', {
                width: session.board.width,
                height: session.board.height,
              })}
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

        <div className="np-board-scroll">
          <NumberPathBoard
            session={session}
            hint={hint}
            onTrace={onTrace}
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

      <NumberPathResultOverlay
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
            ? { label: t('numberPathNewBoard'), start: () => startNewBoard(session.difficulty) }
            : undefined
        }
      />
    </div>
  );
}
