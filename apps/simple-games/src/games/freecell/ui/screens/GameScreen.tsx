/**
 * The FreeCell game screen (docs/FREECELL_RULES.md §2, §3, §4, §7).
 *
 * Owns the select-then-place state machine (§3): the first tap picks up a
 * card or run and lights the places it could go; the second puts it there.
 * Tapping the held card again sends it to its foundation when that is legal;
 * a tap somewhere unhelpful moves the selection instead of scolding.
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
import { FreeCellTable, type Selection } from '../components/FreeCellTable';

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
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Counts the moves made on the board now showing, so the table can replay
  // each one (§12). Bumped only where a tap actually changed the board:
  // dealing is not a move, and neither is a tap that did nothing.
  const [moveTick, setMoveTick] = useState(0);

  const board = session?.board ?? null;

  // Board changed (move / undo / restart): a stale selection must not linger.
  useEffect(() => {
    setSelection(null);
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

      // Placing into an empty cell — one card only (§3).
      if (selection && occupant === null) {
        if (selection.type === 'cascade' && selectionIsSingle(board, selection)) {
          if (cascadeToCell(selection.pile, cell)) {
            moved(false);
            return;
          }
        }
        setSelection(null);
        return;
      }

      if (occupant !== null) select({ type: 'cell', cell });
    },
    [board, cascadeToCell, cellToFoundation, moved, select, selection],
  );

  const onFoundationTap = useCallback(
    (suit: Suit) => {
      if (!board) return;
      // A card is never taken back off a foundation (§13), so a foundation is
      // only ever a destination.
      if (!selection) return;
      const head = selectionHead(board, selection);
      if (
        head !== null &&
        suitOf(head) === suit &&
        selectionIsSingle(board, selection) &&
        canPlaceOnFoundation(board, head)
      ) {
        const ok =
          selection.type === 'cell'
            ? cellToFoundation(selection.cell)
            : cascadeToFoundation(selection.pile);
        if (ok) {
          moved(true);
          return;
        }
      }
      setSelection(null);
    },
    [board, cascadeToFoundation, cellToFoundation, moved, selection],
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

      const ok =
        selection.type === 'cell'
          ? cellToCascade(selection.cell, pile)
          : moveRun(selection.pile, selection.index, pile);
      if (ok) {
        moved(false);
        return;
      }

      // Not a legal destination: the tap was picking a new card (§3).
      if (index !== null) select({ type: 'cascade', pile, index });
      else setSelection(null);
    },
    [board, cascadeToFoundation, cellToCascade, moveRun, moved, select, selection],
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

  if (!session || !board) return null;

  // Destinations for the held cards, so the table can light them up (§3).
  // A run that no free cell can carry lights nothing up, which is how the
  // capacity rule shows itself without a number on screen.
  const run = selection ? selectionRun(board, selection) : [];
  const head = run[0] ?? null;
  const destinations: number[] = [];
  if (selection && head !== null && isValidRun(run)) {
    for (let pile = 0; pile < board.cascades.length; pile++) {
      if (selection.type === 'cascade' && pile === selection.pile) continue;
      if (!canPlaceOnCascade(board, head, pile)) continue;
      if (run.length > maxMoveSize(board, pile)) continue;
      destinations.push(pile);
    }
  }
  const foundationEligible =
    selection !== null && head !== null && run.length === 1 && canPlaceOnFoundation(board, head);
  const cellEligible =
    selection !== null &&
    selection.type === 'cascade' &&
    run.length === 1 &&
    freeCellCount(board) > 0;

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
            onCellTap={onCellTap}
            onFoundationTap={onFoundationTap}
            onCascadeTap={onCascadeTap}
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
