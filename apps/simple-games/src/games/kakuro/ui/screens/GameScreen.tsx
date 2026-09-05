/**
 * The Kakuro game screen (docs/KAKURO_RULES.md §4, §5, §6, §10).
 *
 * No clock and no mistake counter on screen: both are recorded and shown on
 * the clear screen instead, so nothing here pushes the player to hurry or
 * keeps a tally in front of them while they think.
 *
 * Four actions, all free and unlimited: undo, erase, notes and hint (§5, §6).
 * Undo exists here where Takuzu has none, and for a concrete reason: writing a
 * digit clears the notes under it and in both of its runs (§4), so a move is
 * non-obviously irreversible and no amount of tapping brings those pencil
 * marks back.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import type { MessageKey } from '@/i18n';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  canUndo,
  colOf,
  indexOf,
  isWhite,
  rowOf,
  type Digit,
  type Hint,
  type KakuroSession,
} from '../../game';
import { useKakuro } from '../../state/GameContext';
import { DigitPad } from '../components/DigitPad';
import { KakuroBoard } from '../components/KakuroBoard';
import { KakuroResultOverlay } from '../components/KakuroResultOverlay';

/**
 * Long enough to read a full sentence twice — a hint explains a reason, not a
 * single word, and plenty of players are reading it in a second language.
 */
const TOAST_MS = 5000;

/**
 * One plain sentence per hint shape. No technique name ever reaches the screen
 * (§6), and no sentence names a direction: the same deduction can come off the
 * horizontal run, the vertical one, or the crossing of the two, so "row" would
 * be wrong much of the time.
 */
function hintMessage(hint: Hint): MessageKey {
  if (hint.kind === 'violation') return 'kakuroHintBroken';
  return hint.step.kind === 'placement' ? 'kakuroHintPlacement' : 'kakuroHintElimination';
}

/** The square a hint wants the player looking at. */
function hintFocus(hint: Hint): number | null {
  if (hint.kind === 'violation') return hint.cells[0] ?? null;
  if (hint.step.kind === 'placement') return hint.step.index;
  return hint.step.eliminations[0]?.index ?? null;
}

/** Which way each arrow key walks the board, as (row, column) steps. */
const ARROW_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

/**
 * The square an arrow lands on from `from`, or null when that direction runs
 * off the board.
 *
 * Clue squares are stepped over rather than landed on: they are not <button>s
 * at all (`KakuroBoard`), so a tap cannot select one either (§4). An arrow
 * therefore crosses a clue square to the next white one — the run on the far
 * side is a different run, but it is still where a finger would have to go.
 */
function stepFrom(
  session: KakuroSession,
  from: number,
  [rowStep, colStep]: readonly [number, number],
): number | null {
  const { width, height } = session.layout;
  let row = rowOf(from, width);
  let col = colOf(from, width);
  for (;;) {
    row += rowStep;
    col += colStep;
    if (row < 0 || row >= height || col < 0 || col >= width) return null;
    const index = indexOf(row, col, width);
    if (isWhite(session.layout, index)) return index;
  }
}

/**
 * Where the first arrow lands: the middle of the board — where the eyes
 * already are — or the white square nearest it, since the middle of a Kakuro
 * is as likely to be a clue square as not.
 */
function centreOf(session: KakuroSession): number | null {
  const { width, height } = session.layout;
  const middleRow = Math.floor(height / 2);
  const middleCol = Math.floor(width / 2);
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const index of session.table.white) {
    const distance =
      Math.abs(rowOf(index, width) - middleRow) + Math.abs(colOf(index, width) - middleCol);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function KakuroGameScreen() {
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
    startFree,
  } = useKakuro();
  const { t } = useSettings();

  const [selected, setSelected] = useState<number | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const toastTimeout = useTransientTimeout();

  // A new board is a clean slate.
  useEffect(() => {
    setSelected(null);
    setHint(null);
    setToast(null);
    setNotesMode(false);
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

  const onCellTap = useCallback((index: number) => {
    setSelected(index);
    setHint(null);
    sounds.select();
    void haptics.tap();
  }, []);

  const onDigit = useCallback(
    (digit: Digit) => {
      if (selected === null || session === null) return;
      setHint(null);
      if (notesMode) {
        if (toggleNote(selected, digit)) sounds.select();
        return;
      }
      if (!place(selected, digit)) return;
      // A wrong digit gets a quieter sound and nothing else: it is counted, not
      // punished, and the board is never blocked because of one (§5).
      if (session.solution[selected] !== digit) {
        sounds.invalid();
        void haptics.invalid();
      } else {
        sounds.match();
        void haptics.match();
      }
    },
    [notesMode, place, selected, session, toggleNote],
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

  /** The hint points; it never writes the digit for the player (§6). */
  const onHint = useCallback(() => {
    const next = takeHint();
    if (next === null) {
      showToast(t('kakuroHintNone'));
      return;
    }
    setHint(next);
    setSelected(hintFocus(next));
    sounds.select();
    showToast(t(hintMessage(next)));
  }, [showToast, t, takeHint]);

  /* Keyboard as an adapter over the tap handlers above (issue #93, #143):
     arrows move the selection, 1-9 place (or note), Backspace/Delete erase,
     N flips notes, H asks for the hint, Ctrl/Cmd+Z undoes. Every one of them
     calls the handler its own on-screen control calls, so nothing here is
     reachable by keyboard alone.

     State-changing keys ignore key repeat — holding 3 must not place a digit
     per repeat frame — while arrows accept it, because held-arrow travel is
     the point of arrows. Backspace answers `true` even when there is nothing
     to erase, so the browser never treats it as "navigate back" mid-game.

     All nine digit keys stay live all game, the same as the pad: this game
     greys nothing out and counts nothing down (§4). */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && canUndo(session)) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const { key } = event;
    const step = ARROW_STEPS[key];
    if (step) {
      // Edges clamp instead of wrapping: an arrow that runs out of board
      // leaves the selection where it is.
      setSelected((current) =>
        current === null ? centreOf(session) : (stepFrom(session, current, step) ?? current),
      );
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
  useGameKeys(onKey, session !== null && session.status === 'playing' && !confirmRestart);

  if (!session) return null;

  const finished = session.status !== 'playing';
  // Clue squares are not selectable at all (§4), so "nothing to erase" is the
  // same question as "nothing is selected".
  const nothingSelected = selected === null || !isWhite(session.layout, selected);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished || confirmRestart}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="kakuro-status">
            <span className="kakuro-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : session.mode === 'free'
                  ? t('freePlay')
                  : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="kakuro-size-tag">{t('kakuroSizeLabel', { n: session.size })}</span>
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

        <div className="kakuro-body">
          <div className="kakuro-board-scroll">
            <KakuroBoard
              session={session}
              selected={selected}
              hint={hint}
              highlightMistakes={prefs.highlightMistakes}
              onCellTap={onCellTap}
            />
          </div>
          <DigitPad notesMode={notesMode} onDigit={onDigit} />
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
          <button type="button" className="action-btn" onClick={onErase} disabled={nothingSelected}>
            <span className="action-icon" aria-hidden="true">
              ⌫
            </span>
            {t('kakuroErase')}
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
            {t('kakuroNotes')}
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

      <KakuroResultOverlay
        session={session}
        lastResult={lastResult}
        onRetry={restartCurrent}
        onNextLevel={startNextLevel}
        onNewFree={() => startFree(session.freeTier)}
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
