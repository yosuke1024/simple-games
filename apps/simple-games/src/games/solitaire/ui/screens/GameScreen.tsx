/**
 * The Solitaire game screen (docs/SOLITAIRE_RULES.md §3, §4, §7, §8).
 *
 * Owns the select-then-place state machine (§3): the first tap picks up a
 * card or run and lights the places it could go; the second puts it there.
 * Tapping the held card again sends it to its foundation when that is legal;
 * a tap somewhere unhelpful moves the selection instead of scolding.
 *
 * The move count is on screen because it is the game's own measure. The
 * clock is not: it is recorded and shown on the result screen instead, so
 * nothing here pushes the player to hurry.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconCheck, IconHint, IconRetry, IconUndo } from '@/ui/components/icons';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  canAutoFinish,
  canPlaceOnFoundation,
  canPlaceOnTableau,
  suitOf,
  wasteTop,
  type Card,
  type SolitaireBoard,
  type Suit,
} from '../../game';
import { useSolitaire } from '../../state/GameContext';
import { SolitaireResultOverlay } from '../components/SolitaireResultOverlay';
import { SolitaireTable, type HintMarks, type Selection } from '../components/SolitaireTable';

/** How long the hint highlight and the toast stay up. */
const HINT_SHOW_MS = 4000;

/** The card a selection would move (its head), or null. */
function selectionHead(board: SolitaireBoard, selection: Selection): Card | null {
  if (selection.type === 'waste') return wasteTop(board);
  if (selection.type === 'foundation') {
    const pile = board.foundations[selection.suit]!;
    return pile.length === 0 ? null : pile[pile.length - 1]!;
  }
  return board.tableau[selection.pile]?.up[selection.index] ?? null;
}

/** Whether the selection is a single card sitting on top of its pile. */
function selectionIsSingleTop(board: SolitaireBoard, selection: Selection): boolean {
  if (selection.type !== 'tableau') return true;
  return selection.index === board.tableau[selection.pile]!.up.length - 1;
}

export function SolitaireGameScreen() {
  const {
    session,
    lastResult,
    drawCard,
    moveRun,
    runToFoundation,
    wasteToTableau,
    wasteToFoundation,
    foundationToTableau,
    finishGame,
    applyUndo,
    requestHint,
    goHome,
    restartCurrent,
    startFree,
  } = useSolitaire();
  const { t } = useSettings();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [hint, setHint] = useState<HintMarks | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Counts the moves made on the board now showing, so the table can replay
  // each one (§12). Bumped only where a tap actually changed the board:
  // dealing is not a move, and neither is a tap that did nothing.
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

  const moved = useCallback(
    (foundation: boolean) => {
      if (foundation) sounds.match();
      else sounds.select();
      void haptics.tap();
      replay();
    },
    [replay],
  );

  const select = useCallback((next: Selection | null) => {
    setSelection(next);
    if (next) {
      sounds.select();
      void haptics.tap();
    }
  }, []);

  const onStockTap = useCallback(() => {
    setSelection(null);
    if (drawCard()) {
      sounds.select();
      void haptics.tap();
      replay();
    }
  }, [drawCard, replay]);

  const onWasteTap = useCallback(() => {
    if (!board) return;
    if (selection?.type === 'waste') {
      // Second tap on the held card: to its foundation when legal (§3).
      if (wasteToFoundation()) moved(true);
      else setSelection(null);
      return;
    }
    if (wasteTop(board) !== null) select({ type: 'waste' });
  }, [board, moved, select, selection, wasteToFoundation]);

  const onFoundationTap = useCallback(
    (suit: Suit) => {
      if (!board) return;
      if (selection) {
        const head = selectionHead(board, selection);
        if (
          head !== null &&
          suitOf(head) === suit &&
          selectionIsSingleTop(board, selection) &&
          canPlaceOnFoundation(board, head)
        ) {
          const ok =
            selection.type === 'waste'
              ? wasteToFoundation()
              : selection.type === 'tableau'
                ? runToFoundation(selection.pile)
                : false;
          if (ok) {
            moved(true);
            return;
          }
        }
        setSelection(null);
        return;
      }
      // Picking a foundation top back up is legal, and rarely wise (§3).
      if (board.foundations[suit]!.length > 0) select({ type: 'foundation', suit });
    },
    [board, moved, runToFoundation, select, selection, wasteToFoundation],
  );

  const onTableauTap = useCallback(
    (pile: number, index: number | null) => {
      if (!board) return;

      if (!selection) {
        if (index !== null) select({ type: 'tableau', pile, index });
        return;
      }

      // Second tap on the same card: to its foundation when legal (§3).
      if (selection.type === 'tableau' && selection.pile === pile && selection.index === index) {
        if (selectionIsSingleTop(board, selection) && runToFoundation(pile)) moved(true);
        else setSelection(null);
        return;
      }

      const ok =
        selection.type === 'waste'
          ? wasteToTableau(pile)
          : selection.type === 'foundation'
            ? foundationToTableau(selection.suit, pile)
            : moveRun(selection.pile, selection.index, pile);
      if (ok) {
        moved(false);
        return;
      }

      // Not a legal destination: the tap was picking a new card (§3).
      if (index !== null) select({ type: 'tableau', pile, index });
      else setSelection(null);
    },
    [
      board,
      foundationToTableau,
      moveRun,
      moved,
      runToFoundation,
      select,
      selection,
      wasteToTableau,
    ],
  );

  // Undo is a move like any other, and the cards go back the way they came.
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      replay();
    }
  }, [applyUndo, replay]);

  const onHint = useCallback(() => {
    if (!board) return;
    const move = requestHint();
    if (!move) {
      showToast(t('solHintNone'));
      return;
    }
    // A run travels from its own start; a card bound for a foundation is the
    // top one on its pile and travels alone.
    const topOf = (pile: number) => ({
      pile,
      index: Math.max(0, (board.tableau[pile]?.up.length ?? 1) - 1),
    });
    const marks: HintMarks =
      move.kind === 'draw'
        ? { stock: true }
        : move.kind === 'waste-foundation'
          ? { waste: true, foundation: true }
          : move.kind === 'waste-tableau'
            ? { waste: true, to: move.to }
            : move.kind === 'tableau-foundation'
              ? { from: topOf(move.from), foundation: true }
              : { from: { pile: move.from, index: move.index }, to: move.to };
    setHint(marks);
    hintTimeout(() => {
      setHint((current) => (current === marks ? null : current));
    }, HINT_SHOW_MS);
  }, [board, hintTimeout, requestHint, showToast, t]);

  const onFinish = useCallback(() => {
    if (finishGame()) {
      sounds.clear();
      void haptics.clear();
      replay();
    }
  }, [finishGame, replay]);

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
     below — the undo key mirrors the button's own disabled condition rather
     than trusting the handler to no-op quietly. */
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

  // Destinations for the held card, so the table can light them up (§3).
  const head = selection ? selectionHead(board, selection) : null;
  const destinations: number[] = [];
  if (selection && head !== null) {
    for (let pile = 0; pile < board.tableau.length; pile++) {
      if (selection.type === 'tableau' && pile === selection.pile) continue;
      if (canPlaceOnTableau(board, head, pile)) destinations.push(pile);
    }
  }
  const foundationEligible =
    selection !== null &&
    head !== null &&
    selection.type !== 'foundation' &&
    selectionIsSingleTop(board, selection) &&
    canPlaceOnFoundation(board, head);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={won}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="sol-status">
            <span className="sol-mode">
              {session.mode === 'daily' ? t('modeDaily') : t('solitaireName')}
            </span>
            <span>{session.drawThree ? t('solDrawThree') : t('solDrawOne')}</span>
            <span className="sol-move-count">
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

        <div className="sol-body">
          <SolitaireTable
            board={board}
            moveTick={moveTick}
            selection={selection}
            hint={hint}
            destinations={destinations}
            foundationEligible={foundationEligible}
            onStockTap={onStockTap}
            onWasteTap={onWasteTap}
            onFoundationTap={onFoundationTap}
            onTableauTap={onTableauTap}
          />
        </div>

        {canAutoFinish(board) ? (
          <div className="sol-finish">
            <button type="button" className="btn btn-primary" onClick={onFinish}>
              <IconCheck className="badge-icon" /> {t('solAutoFinish')}
            </button>
          </div>
        ) : null}

        <div className="action-bar sol-actions">
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

      <SolitaireResultOverlay
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
