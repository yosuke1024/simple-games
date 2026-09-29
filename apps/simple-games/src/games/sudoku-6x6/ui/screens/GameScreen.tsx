/**
 * The Sudoku 6×6 game screen (docs/SUDOKU_6X6_RULES.md §3, §4, §5, §10, §13).
 *
 * No clock and no mistake counter on screen: both are recorded and shown on
 * the clear screen instead, so nothing here pushes the player to hurry (§10).
 *
 * Two rules of the shell's frame this screen keeps: while the Retry dialog or
 * the result is up, `.game-content` is `inert` and the keyboard is off
 * (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」), and the dialog renders
 * after `.game-content`, never inside it.
 */
import { useCallback, useEffect, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  colOf,
  indexOf,
  isGiven,
  rowOf,
  SIZE,
  unitsCompletedBy,
  type Digit,
  type Hint,
} from '../../game';
import { useSudoku6x6 } from '../../state/GameContext';
import { DigitPad } from '../components/DigitPad';
import { Sudoku6x6ResultOverlay } from '../components/ResultOverlay';
import { Sudoku6x6Grid } from '../components/Sudoku6x6Grid';
import { DIFFICULTY_KEY } from '../difficultyKey';
import { HINT_MESSAGE } from '../hintMessage';

/**
 * Long enough to read a full sentence twice — a hint explains a reason, not a
 * single word, and plenty of players are reading it in a second language.
 */
const TOAST_MS = 5000;

/** How long a finished row, column or box glows (§3「完成の合図」). */
const COMPLETE_FLASH_MS = 700;

export function Sudoku6x6GameScreen() {
  const {
    session,
    prefs,
    lastResult,
    sessionEpoch,
    place,
    erase,
    toggleNote,
    applyUndo,
    takeHint,
    goHome,
    restartCurrent,
    startDifficulty,
  } = useSudoku6x6();
  const { t } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  /** The cells of the units the last digit finished, while they glow. */
  const [completed, setCompleted] = useState<ReadonlySet<number> | null>(null);
  const toastTimeout = useTransientTimeout();
  const completeTimeout = useTransientTimeout();
  const reducedMotion = useReducedMotion();

  // A new game is a clean slate.
  useEffect(() => {
    setSelected(null);
    setHint(null);
    setToast(null);
    setNotesMode(false);
    setCompleted(null);
  }, [sessionEpoch]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      // Re-showing restarts the clock; unmount cancels it (useTransientTimeout).
      toastTimeout(() => setToast(null), TOAST_MS);
    },
    [toastTimeout],
  );

  const onCellTap = useCallback((index: number) => {
    setSelected(index);
    setHint(null);
    sounds.select();
    void haptics.tap();
  }, []);

  const onDigit = useCallback(
    (digit: Digit) => {
      if (selected === null || session === null) return;
      if (isGiven(session.board, selected)) return;
      setHint(null);
      if (notesMode) {
        if (toggleNote(selected, digit)) sounds.select();
        return;
      }
      // Read before the digit lands: the units this tap finishes (§3).
      const finished = unitsCompletedBy(session.board, selected, digit);
      if (!place(selected, digit)) return;
      // A wrong digit gets a quieter sound and nothing else: it is counted, not
      // punished, and the board is never blocked because of one (§4).
      if (session.solution[selected] !== digit) {
        sounds.invalid();
        void haptics.invalid();
      } else if (finished.length > 0) {
        // A row, column or box just came together: the match tone a few rungs
        // up, and the unit glows for a beat. Reduced Motion keeps the tone and
        // skips the glow (§3).
        sounds.match(2 * finished.length + 1);
        void haptics.match();
        if (!reducedMotion) {
          setCompleted(new Set(finished.flatMap((unit) => unit.cells)));
          completeTimeout(() => setCompleted(null), COMPLETE_FLASH_MS);
        }
      } else {
        sounds.match();
        void haptics.match();
      }
    },
    [completeTimeout, notesMode, place, reducedMotion, selected, session, toggleNote],
  );

  const onErase = useCallback(() => {
    if (selected === null) return;
    setHint(null);
    if (erase(selected)) sounds.undo();
  }, [erase, selected]);

  const onUndo = useCallback(() => {
    setHint(null);
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  /** The hint points and explains; it never writes a digit (§5). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('sudoku6x6HintNone'));
      return;
    }
    setHint(next);
    setSelected(next.target ?? next.focus[0] ?? null);
    sounds.select();
    showToast(t(HINT_MESSAGE[next.kind], { value: next.digit ?? 0 }));
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the tap handlers above (§3, issue #93):
     arrows move the selection, 1-6 place (or note), Backspace/Delete/0 erase,
     N flips notes, H asks for the hint, Ctrl/Cmd+Z undoes. State-changing keys
     ignore key repeat; arrows accept it, because held-arrow travel is the
     point of arrows. Backspace answers `true` even when there is nothing to
     erase, so the browser never treats it as "navigate back" mid-game. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const { key } = event;
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      setSelected((current) => {
        // The first arrow lands near the middle of the board, and edges clamp
        // instead of wrapping.
        if (current === null) return indexOf(2, 2);
        const row = rowOf(current);
        const col = colOf(current);
        if (key === 'ArrowUp') return row > 0 ? indexOf(row - 1, col) : current;
        if (key === 'ArrowDown') return row < SIZE - 1 ? indexOf(row + 1, col) : current;
        if (key === 'ArrowLeft') return col > 0 ? indexOf(row, col - 1) : current;
        return col < SIZE - 1 ? indexOf(row, col + 1) : current;
      });
      setHint(null);
      return true;
    }
    if (key.length === 1 && key >= '1' && key <= '6') {
      if (!event.repeat) onDigit(Number(key) as Digit);
      return true;
    }
    if (key === 'Backspace' || key === 'Delete' || key === '0') {
      if (!event.repeat) onErase();
      return true;
    }
    if (key === 'n' || key === 'N') {
      if (!event.repeat) setNotesMode((current) => !current);
      return true;
    }
    if (key === 'h' || key === 'H') {
      if (!event.repeat) onHint();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status !== 'solved' && !confirmRestart);

  if (!session) return null;

  const solved = session.status === 'solved';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={solved || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="s6-status">
            <span className="s6-mode">
              {session.mode === 'daily' ? t('modeDaily') : t(DIFFICULTY_KEY[session.difficulty])}
            </span>
            {session.mode === 'daily' ? <span>{t(DIFFICULTY_KEY[session.difficulty])}</span> : null}
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

        <div className="s6-body">
          <Sudoku6x6Grid
            board={session.board}
            solution={session.solution}
            selected={selected}
            hint={hint}
            completed={completed}
            highlightMistakes={prefs.highlightMistakes}
            onCellTap={onCellTap}
          />
          <DigitPad board={session.board} notesMode={notesMode} onDigit={onDigit} />
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
            disabled={session.history.length === 0}
          >
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={onErase}
            disabled={selected === null || isGiven(session.board, selected)}
          >
            <span className="action-icon" aria-hidden="true">
              ⌫
            </span>
            {t('sudoku6x6Erase')}
          </button>
          <button
            type="button"
            className="action-btn"
            aria-pressed={notesMode}
            onClick={() => setNotesMode((current) => !current)}
          >
            <span className="action-icon" aria-hidden="true">
              ✎
            </span>
            {t('sudoku6x6Notes')}
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

      <Sudoku6x6ResultOverlay
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
