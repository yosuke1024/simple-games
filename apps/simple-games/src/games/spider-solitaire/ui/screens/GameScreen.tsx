/**
 * The Spider Solitaire game screen (docs/SPIDER_SOLITAIRE_RULES.md §2, §3,
 * §4, §8).
 *
 * Owns the select-then-place state machine (§3): the first tap picks up a run
 * and lights the columns it could go to; the second puts it there. A tap
 * somewhere unhelpful moves the selection instead of scolding.
 *
 * The stock is a button like any other spot. Tapping it while a column stands
 * empty says why in a quiet line rather than refusing in silence — that rule
 * (§3) is the one players most often meet without knowing it exists.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  canDeal,
  canPlaceOnColumn,
  isMovableRun,
  movableRunStart,
  type Card,
  type SpiderBoard,
} from '../../game';
import { useSpider } from '../../state/GameContext';
import { SpiderResultOverlay } from '../components/SpiderResultOverlay';
import { SpiderTable, type HintMarks, type Selection } from '../components/SpiderTable';

/** How long the hint highlight and the toast stay up. */
const HINT_SHOW_MS = 4000;

/** The cards a selection carries, bottom first. */
function selectionRun(board: SpiderBoard, selection: Selection): readonly Card[] {
  return board.tableau[selection.pile]?.up.slice(selection.index) ?? [];
}

export function SpiderGameScreen() {
  const {
    session,
    lastResult,
    stuck,
    moveRun,
    dealRow,
    applyUndo,
    requestHint,
    goHome,
    restartCurrent,
    startFree,
  } = useSpider();
  const { t } = useSettings();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hint, setHint] = useState<HintMarks | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Counts the moves made on the board now showing, so the table can replay
  // each one (§12). Bumped only where a tap actually changed the board.
  const [moveTick, setMoveTick] = useState(0);
  const toastTimeout = useTransientTimeout();
  const hintTimeout = useTransientTimeout();

  const board = session?.board ?? null;

  // Board changed (move / undo / restart): stale marks must not linger.
  useEffect(() => {
    setSelection(null);
    setHint(null);
  }, [board]);

  const showToast = useCallback(
    (message: string) => {
      setToast(message);
      // Re-showing restarts the clock; unmount cancels it (useTransientTimeout).
      toastTimeout(() => setToast(null), HINT_SHOW_MS);
    },
    [toastTimeout],
  );

  const replay = useCallback(() => setMoveTick((n) => n + 1), []);

  const select = useCallback((next: Selection | null) => {
    setSelection(next);
    if (next) {
      sounds.select();
      void haptics.tap();
    }
  }, []);

  const onStockTap = useCallback(() => {
    if (!board) return;
    setSelection(null);
    if (dealRow()) {
      sounds.addNumbers();
      void haptics.tap();
      replay();
      return;
    }
    // The classic rule catches people out, so it says so rather than doing
    // nothing (§3). No scolding sound — this is information, not a mistake.
    if (board.stock.length > 0 && !canDeal(board)) showToast(t('spiderStockBlocked'));
  }, [board, dealRow, replay, showToast, t]);

  const onColumnTap = useCallback(
    (pile: number, index: number | null) => {
      if (!board) return;

      if (!selection) {
        if (index !== null) select({ pile, index });
        return;
      }

      // Second tap on the held card clears it — there is no foundation to send
      // it to in Spider; a run leaves the table on its own when it is finished.
      if (selection.pile === pile && selection.index === index) {
        setSelection(null);
        return;
      }

      if (moveRun(selection.pile, selection.index, pile)) {
        sounds.select();
        void haptics.tap();
        replay();
        return;
      }

      // Not a legal destination: the tap was picking a new card (§3).
      if (index !== null) select({ pile, index });
      else setSelection(null);
    },
    [board, moveRun, replay, select, selection],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      replay();
    }
  }, [applyUndo, replay]);

  const onHint = useCallback(() => {
    const move = requestHint();
    if (!move) {
      showToast(t('spiderHintNone'));
      return;
    }
    const marks: HintMarks =
      move.kind === 'deal'
        ? { stock: true }
        : { from: { pile: move.from, index: move.index }, to: move.to };
    setHint(marks);
    hintTimeout(() => {
      setHint((current) => (current === marks ? null : current));
    }, HINT_SHOW_MS);
  }, [hintTimeout, requestHint, showToast, t]);

  // A run finishing is the moment worth marking, and it is the only thing in
  // this game that happens without a tap of its own.
  const completed = board?.completed.length ?? 0;
  const completedRef = useRef(completed);
  useEffect(() => {
    if (completed > completedRef.current) sounds.clear();
    completedRef.current = completed;
  }, [completed]);

  // The win chime belongs to the win, not to a particular move.
  const won = session?.status === 'won';
  const wonRef = useRef(won);
  useEffect(() => {
    if (won && !wonRef.current) {
      sounds.clear();
      void haptics.clear();
    }
    wonRef.current = won;
  }, [won]);

  /* Keyboard as an adapter over the tap handlers above (issue #93): Ctrl/Cmd+Z
     undoes and H asks for a hint, exactly like the two action-bar buttons
     below. Being stuck (§2) does not disable those buttons — the stuck note
     is informational, and undo is what gets a player out — so it does not
     disable the keys either. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && session.history.length > 0) onUndo();
      return true;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.key === 'h' || event.key === 'H') {
      if (!event.repeat) onHint();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status !== 'won' && !confirmRestart);

  if (!session || !board) return null;

  // Destinations for the held run, so the table can light them up (§3).
  const run = selection ? selectionRun(board, selection) : [];
  const head = run[0] ?? null;
  const destinations: number[] = [];
  if (selection && head !== null && isMovableRun(run, board.suitCount)) {
    for (let pile = 0; pile < board.tableau.length; pile++) {
      if (pile === selection.pile) continue;
      if (canPlaceOnColumn(board, head, pile)) destinations.push(pile);
    }
  }

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={won}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="sp-status">
            <span className="sp-mode">
              {session.mode === 'daily' ? t('modeDaily') : t('spiderName')}
            </span>
            <span>
              {session.suitCount === 1
                ? t('spiderOneSuit')
                : session.suitCount === 2
                  ? t('spiderTwoSuits')
                  : t('spiderFourSuits')}
            </span>
            <span className="sp-move-count">
              {t('movesLabel')} {session.moveCount}
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

        <div className="sp-body">
          <SpiderTable
            board={board}
            moveTick={moveTick}
            selection={selection}
            hint={hint}
            destinations={destinations}
            onStockTap={onStockTap}
            onColumnTap={onColumnTap}
          />

          {/* Said once, quietly, beside the board — never as an alert over it.
              Undo sits in the action bar below and steps straight back out. */}
          {stuck ? (
            <div className="sp-stuck" role="status">
              <p className="sp-stuck-title">{t('spiderStuckTitle')}</p>
              <p className="sp-stuck-body">{t('spiderStuckBody')}</p>
            </div>
          ) : null}
        </div>

        <div className="action-bar sp-actions">
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
          <button type="button" className="action-btn" onClick={onHint}>
            <span className="action-icon" aria-hidden="true">
              <IconHint />
            </span>
            {t('hint')}
          </button>
        </div>

        <BannerSlot />
      </div>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      <SpiderResultOverlay
        session={session}
        lastResult={lastResult}
        onNewDeal={startFree}
        onRetry={restartCurrent}
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

/** Kept for the rules doc's sake: the deepest card a column offers (§3). */
export { movableRunStart };
