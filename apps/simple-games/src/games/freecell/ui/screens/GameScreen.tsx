/**
 * The FreeCell game screen (docs/FREECELL_RULES.md §2, §3, §4, §7).
 *
 * Owns the select-then-place state machine (§3): the first tap picks up a
 * card or run and lights the places it could go; the second puts it there.
 * Tapping the held card again sends it to its foundation when that is legal;
 * a tap somewhere unhelpful moves the selection instead of scolding.
 *
 * A drag is the same move by another hand (§3, issue #119): picking a card up
 * lights the same places, and letting it go over one of them puts it there
 * through the same three functions the second tap uses — nothing about the
 * rules is asked twice. The tap path stays whole: it is how the game is
 * played from a keyboard, by assistive technology, and by anyone whose hands
 * do not do drags today.
 *
 * There is no Hint button here, unlike Klondike and Spider. Every card is
 * face up from the deal, so a hint would not be uncovering anything the
 * player cannot see — it would be taking the decision (§8). Undo is free and
 * unlimited in its place, and it is what makes the dead end (§2) survivable.
 *
 * The move count is on screen because it is the game's own measure. The clock
 * is not: it is recorded and shown on the result screen instead, so nothing
 * here pushes the player to hurry.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconCheck, IconRetry, IconUndo } from '@/ui/components/icons';
import { isUndoKey, useGameKeys } from '@/ui/useGameKeys';
import {
  canAutoFinish,
  canPlaceOnCascade,
  canPlaceOnFoundation,
  freeCellCount,
  isValidRun,
  maxMoveSize,
  suitOf,
  type Card,
  type FreeCellBoard,
  type Suit,
} from '../../game';
import { useFreeCell } from '../../state/GameContext';
import { FreeCellResultOverlay } from '../components/FreeCellResultOverlay';
import {
  FreeCellTable,
  type DragSource,
  type DropTarget,
  type Selection,
} from '../components/FreeCellTable';

/** The card a selection would move (its head), or null. */
function selectionHead(board: FreeCellBoard, selection: Selection): Card | null {
  if (selection.type === 'cell') return board.cells[selection.cell] ?? null;
  return board.cascades[selection.pile]?.[selection.index] ?? null;
}

/** The cards a selection carries, bottom first. */
function selectionRun(board: FreeCellBoard, selection: Selection): readonly Card[] {
  if (selection.type === 'cell') {
    const card = board.cells[selection.cell];
    return card === null || card === undefined ? [] : [card];
  }
  return board.cascades[selection.pile]?.slice(selection.index) ?? [];
}

/** Whether the selection is a single card — the only thing a cell can hold. */
function selectionIsSingle(board: FreeCellBoard, selection: Selection): boolean {
  return selectionRun(board, selection).length === 1;
}

export function FreeCellGameScreen() {
  const {
    session,
    lastResult,
    stuck,
    cascadeToCell,
    cascadeToFoundation,
    cellToCascade,
    cellToFoundation,
    moveRun,
    finishGame,
    applyUndo,
    goHome,
    restartCurrent,
    startFree,
  } = useFreeCell();
  const { t } = useSettings();
  const [selection, setSelection] = useState<Selection | null>(null);
  /**
   * The card or run under a finger, and the spot it is over (§3, issue #119).
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
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Counts the moves made on the board now showing, so the table can replay
  // each one (§12). Bumped only where a tap actually changed the board:
  // dealing is not a move, and neither is a tap that did nothing.
  const [moveTick, setMoveTick] = useState(0);

  const board = session?.board ?? null;

  // Board changed (move / undo / restart): stale marks must not linger. A
  // drag in flight is over too — the table lets go of its cards on its side.
  useEffect(() => {
    setSelection(null);
    setDrag(null);
    setDrop(null);
  }, [board]);

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

  /**
   * Puts what is held down on a cascade column (§3): the second tap's job,
   * and a drop's. False when the move is not legal, and then nothing has
   * changed — a non-run or a run too long for the free cells simply returns
   * to where it was, the same as a tap selection the engine refuses.
   */
  const placeOnCascade = useCallback(
    (held: Selection, pile: number): boolean => {
      const ok =
        held.type === 'cell'
          ? cellToCascade(held.cell, pile)
          : moveRun(held.pile, held.index, pile);
      if (ok) moved(false);
      return ok;
    },
    [cellToCascade, moveRun, moved],
  );

  /**
   * Puts what is held down into one free cell (§3), for a tap and a drop
   * alike: only a single cascade card goes into a cell — a cell card dropped
   * on another cell is not a move, and `cascadeToCell` itself refuses an
   * occupied one.
   */
  const placeOnCell = useCallback(
    (held: Selection, cell: number): boolean => {
      if (!board) return false;
      const ok =
        held.type === 'cascade' && selectionIsSingle(board, held) && cascadeToCell(held.pile, cell);
      if (ok) moved(false);
      return ok;
    },
    [board, cascadeToCell, moved],
  );

  /**
   * Puts what is held down on one suit's foundation (§3), for a tap and a
   * drop alike: the card has to be that suit's, alone, and the next one the
   * foundation needs. False otherwise, board untouched — a foundation is
   * never a source (§13), so this is only ever reached with a cell or
   * cascade card in hand.
   */
  const placeOnFoundation = useCallback(
    (held: Selection, suit: Suit): boolean => {
      if (!board) return false;
      const head = selectionHead(board, held);
      if (
        head === null ||
        suitOf(head) !== suit ||
        !selectionIsSingle(board, held) ||
        !canPlaceOnFoundation(board, head)
      ) {
        return false;
      }
      const ok =
        held.type === 'cell' ? cellToFoundation(held.cell) : cascadeToFoundation(held.pile);
      if (ok) moved(true);
      return ok;
    },
    [board, cascadeToFoundation, cellToFoundation, moved],
  );

  const onCellTap = useCallback(
    (cell: number) => {
      if (!board) return;
      const occupant = board.cells[cell] ?? null;

      // Second tap on the held cell card: to its foundation when legal (§3).
      if (selection?.type === 'cell' && selection.cell === cell) {
        if (cellToFoundation(cell)) moved(true);
        else setSelection(null);
        return;
      }

      // Placing into an empty cell — one card only (§3), and a drop's job too.
      if (selection && occupant === null) {
        if (placeOnCell(selection, cell)) return;
        setSelection(null);
        return;
      }

      if (occupant !== null) select({ type: 'cell', cell });
    },
    [board, cellToFoundation, moved, placeOnCell, select, selection],
  );

  const onFoundationTap = useCallback(
    (suit: Suit) => {
      if (!board) return;
      // A card is never taken back off a foundation (§13), so a foundation is
      // only ever a destination.
      if (!selection) return;
      if (!placeOnFoundation(selection, suit)) setSelection(null);
    },
    [board, placeOnFoundation, selection],
  );

  const onCascadeTap = useCallback(
    (pile: number, index: number | null) => {
      if (!board) return;

      if (!selection) {
        if (index !== null) select({ type: 'cascade', pile, index });
        return;
      }

      // Second tap on the same card: to its foundation when legal (§3).
      if (selection.type === 'cascade' && selection.pile === pile && selection.index === index) {
        if (selectionIsSingle(board, selection) && cascadeToFoundation(pile)) moved(true);
        else setSelection(null);
        return;
      }

      if (placeOnCascade(selection, pile)) return;

      // Not a legal destination: the tap was picking a new card (§3).
      if (index !== null) select({ type: 'cascade', pile, index });
      else setSelection(null);
    },
    [board, cascadeToFoundation, moved, placeOnCascade, select, selection],
  );

  /**
   * A press on a card has travelled far enough to be a drag (§3, issue #119).
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
   * is the second tap by another hand: the same three functions decide, and a
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
      if (target.type === 'cascade') return placeOnCascade(source, target.pile);
      if (target.type === 'cell') return placeOnCell(source, target.cell);
      return placeOnFoundation(source, target.suit);
    },
    [placeOnCascade, placeOnCell, placeOnFoundation],
  );

  // Undo is a move like any other, and the cards go back the way they came.
  const onUndo = useCallback(() => {
    if (applyUndo()) {
      sounds.undo();
      replay();
    }
  }, [applyUndo, replay]);

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

  /* Keyboard as an adapter over the tap handler above (issue #93): Ctrl/Cmd+Z
     undoes, exactly like the action-bar button below — mirroring its disabled
     condition rather than trusting the handler to no-op quietly. No H-for-hint
     here: this screen has no Hint button to mirror (§8), and being stuck (§2)
     does not disable Undo, so it does not disable the key either. */
  const onKey = (event: KeyboardEvent): boolean => {
    if (session === null) return false;
    if (isUndoKey(event)) {
      if (!event.repeat && session.history.length > 0) onUndo();
      return true;
    }
    return false;
  };
  useGameKeys(onKey, session !== null && session.status !== 'won' && !confirmRestart);

  if (!session || !board) return null;

  // Destinations for the held cards, so the table can light them up (§3) —
  // held by a tap or under a finger, the answer is the same. A run that no
  // free cell can carry (or that is not a run at all — any card carried up
  // by a drag, valid or not, §3, issue #119) lights nothing up, which is how
  // the capacity rule shows itself without a number on screen.
  const held: Selection | null = drag ?? selection;
  const run = held ? selectionRun(board, held) : [];
  const head = run[0] ?? null;
  const destinations: number[] = [];
  if (held && head !== null && isValidRun(run)) {
    for (let pile = 0; pile < board.cascades.length; pile++) {
      if (held.type === 'cascade' && pile === held.pile) continue;
      if (!canPlaceOnCascade(board, head, pile)) continue;
      if (run.length > maxMoveSize(board, pile)) continue;
      destinations.push(pile);
    }
  }
  const foundationEligible =
    held !== null && head !== null && run.length === 1 && canPlaceOnFoundation(board, head);
  const cellEligible =
    held !== null && held.type === 'cascade' && run.length === 1 && freeCellCount(board) > 0;
  // Whether letting go where the drag is would move: the one spot the table
  // marks as such, read off the same answers as the highlights above. A cell
  // is only a legal drop when it stands empty — the geometry alone cannot
  // say that; a cascade card dropped back on its own occupied cell must not
  // ring as though it would move.
  const dropLegal =
    drop !== null &&
    (drop.type === 'cascade'
      ? destinations.includes(drop.pile)
      : drop.type === 'cell'
        ? cellEligible && board.cells[drop.cell] === null
        : foundationEligible && head !== null && suitOf(head) === drop.suit);

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={won}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="fc-status">
            <span className="fc-mode">
              {session.mode === 'daily' ? t('modeDaily') : t('freecellName')}
            </span>
            <span className="fc-move-count">
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

        <div className="fc-body">
          <FreeCellTable
            board={board}
            moveTick={moveTick}
            selection={selection}
            destinations={destinations}
            foundationEligible={foundationEligible}
            cellEligible={cellEligible}
            drag={drag}
            drop={drop}
            dropLegal={dropLegal}
            onCellTap={onCellTap}
            onFoundationTap={onFoundationTap}
            onCascadeTap={onCascadeTap}
            onDragStart={onDragStart}
            onDragTarget={onDragTarget}
            onDragEnd={onDragEnd}
          />

          {/* Said once, quietly, beside the board — never as an alert over it.
              Undo sits in the action bar below and steps straight back out. */}
          {stuck ? (
            <div className="fc-stuck" role="status">
              <p className="fc-stuck-title">{t('fcStuckTitle')}</p>
              <p className="fc-stuck-body">{t('fcStuckBody')}</p>
            </div>
          ) : null}
        </div>

        {canAutoFinish(board) ? (
          <div className="fc-finish">
            <button type="button" className="btn btn-primary" onClick={onFinish}>
              <IconCheck className="badge-icon" /> {t('fcAutoFinish')}
            </button>
          </div>
        ) : null}

        <div className="action-bar fc-actions">
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
        </div>

        <BannerSlot />
      </div>

      <FreeCellResultOverlay
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
