/**
 * The Sudoku game screen (docs/SUDOKU_RULES.md §3, §4, §5, §12).
 *
 * No clock and no mistake counter on screen: both are recorded and shown on the
 * clear screen instead, so nothing here pushes the player to hurry.
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
import { useSudoku } from '../../state/GameContext';
import { DigitPad } from '../components/DigitPad';
import { SudokuGrid } from '../components/SudokuGrid';
import { SudokuResultOverlay } from '../components/SudokuResultOverlay';

/**
 * Long enough to read a full sentence twice — a hint explains a reason, not a
 * single word, and plenty of players are reading it in a second language.
 */
const TOAST_MS = 5000;

/**
 * How long a finished row, column or box glows (§3「完成の合図」): one beat,
 * long enough to be seen, short enough to be gone before the next digit.
 */
const COMPLETE_FLASH_MS = 700;

/** One plain sentence per hint shape — no technique names (§5). */
const HINT_MESSAGE = {
  onlyDigitForCell: 'sudokuHintOnlyDigit',
  onlyCellForDigit: 'sudokuHintOnlyCell',
  digitLockedToLine: 'sudokuHintLockedLine',
  digitLockedToBox: 'sudokuHintLockedBox',
  candidatesRuledOut: 'sudokuHintRuledOut',
} as const;

export function SudokuGameScreen() {
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
    startNextLevel,
  } = useSudoku();
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
        // A row, column or box just came together: the match tone a few
        // rungs up (higher again for two or three at once), and the unit
        // glows for a beat. Reduced Motion keeps the tone and skips the glow.
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

  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('sudokuHintNone'));
      return;
    }
    setHint(next);
    setSelected(next.target ?? next.focus[0] ?? null);
    sounds.select();
    showToast(
      t(HINT_MESSAGE[next.kind], {
        value: next.digit ?? 0,
        n: next.focus.length,
      }),
    );
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the tap handlers above (issue #93): arrows
     move the selection, 1-9 place (or note), Backspace/Delete erase, N flips
     notes, H asks for the hint, Ctrl/Cmd+Z undoes. State-changing keys ignore
     key repeat — holding 5 must not place a digit per repeat frame — while
     arrows accept it, because held-arrow travel is the point of arrows.
     Backspace answers `true` even when there is nothing to erase, so the
     browser never treats it as "navigate back" mid-game. */
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
        // The first arrow lands in the middle of the board — where the eyes
        // already are — and edges clamp instead of wrapping.
        if (current === null) return indexOf(4, 4);
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
    if (key.length === 1 && key >= '1' && key <= '9') {
      if (!event.repeat) onDigit(Number(key) as Digit);
      return true;
    }
    if (key === 'Backspace' || key === 'Delete') {
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
      <div className="game-content" inert={solved}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="sudoku-status">
            <span className="sudoku-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span>{t(`sudokuTier_${session.difficulty}`)}</span>
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

        <div className="sudoku-body">
          <SudokuGrid
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
            {t('sudokuErase')}
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
            {t('sudokuNotes')}
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

      <SudokuResultOverlay
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
