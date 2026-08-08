/**
 * The Futoshiki game screen (docs/FUTOSHIKI_RULES.md §4, §5, §6, §10).
 *
 * No clock and no mistake counter on screen: both are recorded and shown on
 * the clear screen instead, so nothing here pushes the player to hurry or
 * keeps a tally in front of them while they think.
 *
 * Four actions, all free and unlimited: undo, erase, notes and hint (§5, §6).
 * Undo exists here where Takuzu has none, and for a concrete reason: writing a
 * digit clears the notes under it and in its whole row and column (§4), so a
 * move is non-obviously irreversible and no amount of tapping brings those
 * pencil marks back.
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
import { canUndo, isGiven, type Digit, type Hint } from '../../game';
import { useFutoshiki } from '../../state/GameContext';
import { DigitPad } from '../components/DigitPad';
import { FutoshikiBoard } from '../components/FutoshikiBoard';
import { FutoshikiResultOverlay } from '../components/FutoshikiResultOverlay';

/**
 * Long enough to read a full sentence twice — a hint explains a reason, not a
 * single word, and plenty of players are reading it in a second language.
 */
const TOAST_MS = 5000;

/**
 * One plain sentence per hint shape. No technique name ever reaches the screen
 * (§6), and no sentence names an axis: the same deduction can come off a row,
 * a column or the signs, so "row" would be wrong a third of the time.
 */
function hintMessage(hint: Hint): MessageKey {
  if (hint.kind === 'violation') {
    return hint.constraints.length > 0 ? 'futoshikiHintBrokenSign' : 'futoshikiHintBrokenLine';
  }
  return hint.step.kind === 'placement' ? 'futoshikiHintPlacement' : 'futoshikiHintElimination';
}

/** The square a hint wants the player looking at. */
function hintFocus(hint: Hint): number | null {
  if (hint.kind === 'violation') return hint.cells[0] ?? null;
  if (hint.step.kind === 'placement') return hint.step.index;
  return hint.step.eliminations[0]?.index ?? null;
}

export function FutoshikiGameScreen() {
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
  } = useFutoshiki();
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
      if (isGiven(session.board, selected)) return;
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
      showToast(t('futoshikiHintNone'));
      return;
    }
    setHint(next);
    setSelected(hintFocus(next));
    sounds.select();
    showToast(t(hintMessage(next)));
  }, [showToast, t, takeHint]);

  if (!session) return null;

  const finished = session.status !== 'playing';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="futoshiki-status">
            <span className="futoshiki-mode">
              {session.mode === 'daily'
                ? t('modeDaily')
                : t('modeLevel', { n: session.level ?? 1 })}
            </span>
            <span className="futoshiki-size-tag">
              {t('futoshikiSizeLabel', { n: session.size })}
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

        <div className="futoshiki-body">
          <div className="futoshiki-board-scroll">
            <FutoshikiBoard
              session={session}
              selected={selected}
              hint={hint}
              highlightMistakes={prefs.highlightMistakes}
              onCellTap={onCellTap}
            />
          </div>
          <DigitPad session={session} notesMode={notesMode} onDigit={onDigit} />
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
          <button
            type="button"
            className="action-btn"
            onClick={onErase}
            disabled={selected === null || isGiven(session.board, selected)}
          >
            <span className="action-icon" aria-hidden="true">
              ⌫
            </span>
            {t('futoshikiErase')}
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
            {t('futoshikiNotes')}
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

      <FutoshikiResultOverlay
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
