/**
 * The Solitaire game screen (docs/SOLITAIRE_RULES.md §3, §4, §7, §8).
 *
 * Owns the select-then-place state machine (§3): the first tap picks up a
 * card or run and lights the places it could go; the second puts it there.
 * Tapping the held card again sends it to its foundation when that is legal;
 * a tap somewhere unhelpful moves the selection instead of scolding.
 *
 * A drag is the same move by another hand (§3, issue #116): picking a card up
 * lights the same places, and letting it go over one of them puts it there
 * through the same two functions the second tap uses — nothing about the
 * rules is asked twice. The tap path stays whole: it is how the game is
 * played from a keyboard, by assistive technology, and by anyone whose hands
 * do not do drags today.
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
import {
  SolitaireTable,
  type DragSource,
  type DropTarget,
  type HintMarks,
  type Selection,
} from '../components/SolitaireTable';

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
  /**
   * The card or run under a finger, and the spot it is over (§3, issue #116).
   * Held like a selection is held — the same destinations light up — but
   * never at the same time as one: picking a card up puts down whatever a tap
   * had selected, and a drag that ends is over, selected nothing.
   */
  const [drag, setDrag] = useState<DragSource | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  /**
   * What a tap had picked up when a press turned into a drag, kept until the
   * release says which the press was. A press let go all but where it began
   * is the tap the browser still thinks it is — the second tap of a
   * select-then-place, say, made by a finger that rolled a little — and the
   * selection it was going to place has to be there when its click lands.
   */
  const tapSelectionRef = useRef<Selection | null>(null);
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

  // Board changed (move / undo / restart): stale marks must not linger. A
  // drag in flight is over too — the table lets go of its cards on its side.
  useEffect(() => {
    setSelection(null);
    setDrag(null);
    setDrop(null);
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

  /**
   * Puts what is held down on a tableau pile (§3): the second tap's job, and a
   * drop's. False when the move is not legal, and then nothing has changed.
   */
  const placeOnTableau = useCallback(
    (held: Selection, pile: number): boolean => {
      const ok =
        held.type === 'waste'
          ? wasteToTableau(pile)
          : held.type === 'foundation'
            ? foundationToTableau(held.suit, pile)
            : moveRun(held.pile, held.index, pile);
      if (ok) moved(false);
      return ok;
    },
    [foundationToTableau, moveRun, moved, wasteToTableau],
  );

  /**
   * Puts what is held down on one suit's foundation (§3), for a tap and a
   * drop alike: the card has to be that suit's, alone on top of its pile, and
   * the next one the foundation needs. False otherwise, board untouched.
   */
  const placeOnFoundation = useCallback(
    (held: Selection, suit: Suit): boolean => {
      if (!board) return false;
      const head = selectionHead(board, held);
      if (
        head === null ||
        suitOf(head) !== suit ||
        !selectionIsSingleTop(board, held) ||
        !canPlaceOnFoundation(board, head)
      ) {
        return false;
      }
      const ok =
        held.type === 'waste'
          ? wasteToFoundation()
          : held.type === 'tableau'
            ? runToFoundation(held.pile)
            : false;
      if (ok) moved(true);
      return ok;
    },
    [board, moved, runToFoundation, wasteToFoundation],
  );

  const onFoundationTap = useCallback(
    (suit: Suit) => {
      if (!board) return;
      if (selection) {
        if (!placeOnFoundation(selection, suit)) setSelection(null);
        return;
      }
      // Picking a foundation top back up is legal, and rarely wise (§3).
      if (board.foundations[suit]!.length > 0) select({ type: 'foundation', suit });
    },
    [board, placeOnFoundation, select, selection],
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

      if (placeOnTableau(selection, pile)) return;

      // Not a legal destination: the tap was picking a new card (§3).
      if (index !== null) select({ type: 'tableau', pile, index });
      else setSelection(null);
    },
    [board, moved, placeOnTableau, runToFoundation, select, selection],
  );

  /**
   * A press on a card has travelled far enough to be a drag (§3, issue #116).
   * Picking the card up supersedes whatever the tap path had selected, so
   * exactly one thing is ever held — but what it had is remembered, because
   * the release may yet say this press was that tap.
   *
   * Silent, like every other board in this app that is played by dragging:
   * the card lifting under the finger and the places it can go lighting up
   * are the answer, and a note here would land again a moment later when the
   * card is put down.
   */
  const onDragStart = useCallback(
    (source: DragSource) => {
      tapSelectionRef.current = selection;
      setSelection(null);
      setDrag(source);
    },
    [selection],
  );

  const onDragTarget = useCallback((target: DropTarget | null) => setDrop(target), []);

  /**
   * The drag let go — over a spot, over nothing, or taken away. Over a spot it
   * is the second tap by another hand: the same two functions decide, and a
   * drop that is not legal changes nothing and selects nothing (§3). Returns
   * whether the board changed, so the table knows whether to carry the cards
   * back or let the replay settle them.
   */
  const onDragEnd = useCallback(
    (source: DragSource, target: DropTarget | null, tapFollows: boolean): boolean => {
      setDrag(null);
      setDrop(null);
      const wasHeld = tapSelectionRef.current;
      tapSelectionRef.current = null;
      // Barely moved: the press was the tap the browser is still about to
      // report. Put back what it was holding and place nothing — the click
      // that follows finishes the move the player was making, exactly as it
      // did before this table could be dragged at all.
      if (tapFollows) {
        setSelection(wasHeld);
        return false;
      }
      if (target === null) return false;
      return target.type === 'tableau'
        ? placeOnTableau(source, target.pile)
        : placeOnFoundation(source, target.suit);
    },
    [placeOnFoundation, placeOnTableau],
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

  // Destinations for the held card, so the table can light them up (§3) —
  // held by a tap or under a finger, the answer is the same.
  const held: Selection | null = drag ?? selection;
  const head = held ? selectionHead(board, held) : null;
  const destinations: number[] = [];
  if (held && head !== null) {
    for (let pile = 0; pile < board.tableau.length; pile++) {
      if (held.type === 'tableau' && pile === held.pile) continue;
      if (canPlaceOnTableau(board, head, pile)) destinations.push(pile);
    }
  }
  // The one foundation it could go to — its own suit's, and only when it is
  // the next card that foundation needs (§3). One cell lights, not four: the
  // mark says where the card can go, and it can go to one place.
  const foundationTarget: Suit | null =
    held !== null &&
    head !== null &&
    held.type !== 'foundation' &&
    selectionIsSingleTop(board, held) &&
    canPlaceOnFoundation(board, head)
      ? suitOf(head)
      : null;
  // Whether letting go where the drag is would move: the one spot the table
  // marks as such, read off the same answers as the highlights above.
  const dropLegal =
    drop !== null &&
    (drop.type === 'tableau' ? destinations.includes(drop.pile) : drop.suit === foundationTarget);

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
            foundationTarget={foundationTarget}
            drag={drag}
            drop={drop}
            dropLegal={dropLegal}
            onStockTap={onStockTap}
            onWasteTap={onWasteTap}
            onFoundationTap={onFoundationTap}
            onTableauTap={onTableauTap}
            onDragStart={onDragStart}
            onDragTarget={onDragTarget}
            onDragEnd={onDragEnd}
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
