/**
 * The Block Puzzle game screen (docs/BLOCK_PUZZLE_RULES.md §3, §7, §12).
 *
 * Two ways in, one move. A drag reads the pointer against the board's own
 * rectangle and lands the piece 1.5 cells above the finger, so the square
 * being chosen is never the square the hand is covering (§3). A tap picks a
 * piece and then a cell, which is how this game is played without a drag at
 * all — by assistive technology, by an external input, by anyone whose hands
 * do not do drags today. Both end in the same pure `placePiece`, so neither
 * can drift into being the one that really works.
 *
 * A drop that is not legal does nothing and says nothing (§3): the piece is
 * back in the tray, the board is untouched, and the game has no opinion about
 * it. The mistake was free, so it needs no feedback.
 *
 * The score is on screen because it is the game's own measure. The clock is
 * not, at all (§12) — elapsed time exists only in the statistics.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { haptics } from '@/services/haptics';
import { sounds } from '@/services/sound';
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { IconBack, IconRetry, IconUndo } from '@/ui/components/icons';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import { BOARD_SIZE, canPlace, pieceById, pieceCells, type Piece } from '../../game';
import { useBlockPuzzle } from '../../state/GameContext';
import { BlockBoard } from '../components/BlockBoard';
import { BlockResultOverlay } from '../components/BlockResultOverlay';
import { BlockTray } from '../components/BlockTray';

/**
 * How far above the finger the piece rides, in cells (§3). One and a half is
 * what it takes for a fingertip to sit clear of the shape's bottom row on a
 * phone: a whole cell still leaves the landing row half-covered.
 */
const DRAG_LIFT_CELLS = 1.5;

/**
 * How far the pointer must travel before a press counts as a drag rather than
 * a tap. Without it, the tremor in an ordinary tap would swallow the tap path.
 */
const DRAG_THRESHOLD_PX = 8;

/** How long a cleared line stays visible as it fades (§12). */
const CLEAR_FADE_MS = 150;

const NO_CELLS: readonly number[] = [];

/** Where a dragged piece would put its top-left corner. */
interface Landing {
  readonly row: number;
  readonly col: number;
}

/**
 * The live values of one drag. A ref, not state: these change with every
 * pointer event, and only the ghost below is worth a render. Nothing here
 * survives the pointer being released, cancelled, or the screen unmounting.
 */
interface DragState {
  readonly slot: number;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
  /** The legal landing under the pointer, or null while there is none. */
  landing: Landing | null;
  /** The ghost currently rendered, so an unchanged one costs no render. */
  ghostKey: string;
}

export function BlockGameScreen() {
  const { session, stats, lastResult, canUndoNow, play, applyUndo, goHome, startNewGame } =
    useBlockPuzzle();
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const fadeTimeout = useTransientTimeout();

  const [confirmNewGame, setConfirmNewGame] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);
  const [ghost, setGhost] = useState<readonly number[]>(NO_CELLS);
  const [clearing, setClearing] = useState<readonly number[]>(NO_CELLS);

  const boardElRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** A drag ends with a click too; that click must not also count as a tap. */
  const suppressTapRef = useRef(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const setBoardEl = useCallback((element: HTMLDivElement | null) => {
    boardElRef.current = element;
  }, []);

  // A new tray — placement, undo, refill, new board — invalidates a selection
  // that pointed into the old one.
  const tray = session?.tray;
  useEffect(() => {
    setSelected(null);
  }, [tray]);

  /** Runs a placement and everything it sounds and looks like (§12). */
  const commit = useCallback(
    (slot: number, row: number, col: number) => {
      const outcome = play(slot, row, col);
      // Not legal: the board is unchanged, so there is nothing to say (§3).
      if (!outcome.placed) return;

      setSelected(null);
      sounds.select();
      void haptics.tap();
      // A clear and an ending are their own events, not louder placements —
      // each adds its own note rather than replacing the one before it (§12).
      if (outcome.lines > 0) {
        sounds.clear();
        void haptics.clear();
      }
      if (outcome.over) {
        sounds.gameOver();
        void haptics.invalid();
      }

      // The board has already settled; this is the trace of what was there.
      // Reduced Motion skips it entirely and the line is simply gone (§12).
      if (outcome.cleared.length > 0 && !reducedMotion) {
        setClearing(outcome.cleared);
        fadeTimeout(() => setClearing(NO_CELLS), CLEAR_FADE_MS);
      }
    },
    [fadeTimeout, play, reducedMotion],
  );

  /** Where the piece under the pointer would land, lifted clear of it (§3). */
  const resolveLanding = useCallback(
    (clientX: number, clientY: number, piece: Piece): Landing | null => {
      const element = boardElRef.current;
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      // A board with no layout yet (a first frame, a hidden tab) can answer
      // nothing honest about where a cell is.
      if (rect.width === 0 || rect.height === 0) return null;
      const cellWidth = rect.width / BOARD_SIZE;
      const cellHeight = rect.height / BOARD_SIZE;
      // Centre the shape on the pointer, then lift it — so a wide piece is held
      // in the middle rather than by its top-left corner.
      const centreRow = (clientY - rect.top) / cellHeight - DRAG_LIFT_CELLS;
      const centreCol = (clientX - rect.left) / cellWidth;
      return {
        row: Math.round(centreRow - piece.height / 2),
        col: Math.round(centreCol - piece.width / 2),
      };
    },
    [],
  );

  const onSlotPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, slot: number) => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    if (pieceById(current.tray[slot]) === null) return;

    dragRef.current = {
      slot,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      landing: null,
      ghostKey: '',
    };
    // Capture is an improvement (a finger that leaves the tray keeps
    // steering the piece), never a precondition — it throws if the pointer
    // is already gone, and losing the drag to that would be absurd.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works from the events we do get.
    }
  }, []);

  /**
   * Bound to the body, not to the tray slot the drag started on. Pointer
   * capture retargets the events to that slot, so they arrive here either
   * way — and on the rare engine where capture is refused, a finger moving
   * over the board still reaches this handler by bubbling. Two mechanisms for
   * one thing, but the second one costs nothing and the first one failing
   * would otherwise freeze the piece in mid-air.
   */
  const onBodyPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const current = sessionRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !current) return;
      const piece = pieceById(current.tray[drag.slot]);
      if (piece === null) return;

      if (!drag.moved) {
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        setDragSlot(drag.slot);
        // Picking a piece up supersedes whatever the tap path had selected.
        setSelected(null);
      }

      const landing = resolveLanding(event.clientX, event.clientY, piece);
      const legal =
        landing !== null && canPlace(current.board, piece, landing.row, landing.col)
          ? landing
          : null;
      drag.landing = legal;

      // Only a different landing is worth a render; a pointer moving inside
      // one cell would otherwise re-render the whole board per event.
      const key = legal === null ? '' : `${legal.row},${legal.col}`;
      if (key === drag.ghostKey) return;
      drag.ghostKey = key;
      setGhost(legal === null ? NO_CELLS : pieceCells(piece, legal.row, legal.col));
    },
    [resolveLanding],
  );

  const endDrag = useCallback((): DragState | null => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDragSlot(null);
    setGhost(NO_CELLS);
    return drag;
  }, []);

  const onBodyPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      endDrag();
      // Never moved: this was a tap, and the click that follows selects.
      if (!drag.moved) return;
      suppressTapRef.current = true;
      // Released anywhere illegal: the piece is back in the tray, silently (§3).
      if (drag.landing !== null) commit(drag.slot, drag.landing.row, drag.landing.col);
    },
    [commit, endDrag],
  );

  const onBodyPointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      endDrag();
      if (drag.moved) suppressTapRef.current = true;
    },
    [endDrag],
  );

  /** True once, for the click a finished drag leaves behind. */
  const wasDrag = useCallback((): boolean => {
    if (!suppressTapRef.current) return false;
    suppressTapRef.current = false;
    return true;
  }, []);

  /** The tap path's first half: pick a piece, or put the picked one back (§3). */
  const onSlotActivate = useCallback(
    (slot: number) => {
      if (wasDrag()) return;
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      if (pieceById(current.tray[slot]) === null) return;
      setSelected((picked) => (picked === slot ? null : slot));
    },
    [wasDrag],
  );

  /**
   * The tap path's second half: the piece's first filled cell lands on the
   * tapped cell (§3). With nothing selected the tap does nothing at all — the
   * board is being read, not played.
   */
  const onCellTap = useCallback(
    (row: number, col: number) => {
      // A drag released over the board ends with a click on the cell under
      // it; that click must not place a second piece.
      if (wasDrag()) return;
      const current = sessionRef.current;
      if (selected === null || !current) return;
      const piece = pieceById(current.tray[selected]);
      if (piece === null) return;
      const anchor = piece.cells[0]!;
      commit(selected, row - anchor.row, col - anchor.col);
    },
    [commit, selected, wasDrag],
  );

  const onUndo = useCallback(() => {
    if (applyUndo()) sounds.undo();
  }, [applyUndo]);

  if (!session) return null;

  const over = session.status === 'over';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={over}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <div className="game-status">
            <span className="game-score">
              {t('score')} {session.score}
            </span>
            {/* The record to beat, stated once and quietly — never a target. */}
            <span className="bp-best">
              {t('blockBestScore')} {stats.bestScore}
            </span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={t('newGame')}
            onClick={() => setConfirmNewGame(true)}
          >
            <IconRetry />
          </button>
        </header>

        {/* The drag lives on this wrapper, not on the piece it started from:
            the pointer spends the whole gesture over the board. */}
        <div
          className="bp-body"
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerCancel={onBodyPointerCancel}
        >
          <BlockBoard
            board={session.board}
            ghost={ghost}
            clearing={clearing}
            onCellTap={onCellTap}
            boardRef={setBoardEl}
          />
          <BlockTray
            tray={session.tray}
            selected={selected}
            dragging={dragSlot}
            onSlotPointerDown={onSlotPointerDown}
            onSlotActivate={onSlotActivate}
          />
        </div>

        <div className="action-bar bp-actions">
          <button type="button" className="action-btn" onClick={onUndo} disabled={!canUndoNow}>
            <span className="action-icon" aria-hidden="true">
              <IconUndo />
            </span>
            {t('undo')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <BlockResultOverlay
        session={session}
        lastResult={lastResult}
        onNewGame={startNewGame}
        onHome={goHome}
      />

      <ConfirmDialog
        open={confirmNewGame}
        title={t('confirmNewGameTitle')}
        body={t('confirmNewGameBody')}
        cancelLabel={t('cancel')}
        confirmLabel={t('confirm')}
        onCancel={() => setConfirmNewGame(false)}
        onConfirm={() => {
          setConfirmNewGame(false);
          startNewGame();
        }}
      />
    </div>
  );
}
