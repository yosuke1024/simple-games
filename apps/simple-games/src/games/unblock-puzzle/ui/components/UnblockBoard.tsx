/**
 * The 6×6 board (docs/UNBLOCK_PUZZLE_RULES.md §1, §2, §5, §14).
 *
 * Every block is a button, keyed by its index and moved by `transform`, so
 * React keeps the same element for a block and the browser slides it from
 * its old place to its new one. Reduced Motion (the OS setting or the app's)
 * turns the transition off and the block is simply there. Nothing on the
 * board is text: the target carries an arrow, the exit is a gap in the frame
 * with an arrow beside it, and the other blocks carry a groove along their
 * long side that says which way they slide — so no state is told by colour
 * alone. Each block's label reads its kind, its row and columns (or column
 * and rows) and how many free cells lie on either side of it.
 *
 * Three ways to slide, one move each (§4, §5):
 *
 * - **Drag.** Press a block and pull it along its lane; it follows the
 *   finger inside the free cells (`slideRange`) and settles on the nearest
 *   cell when released. A press that travels less than 8px is a tap. The
 *   press, the moves and the release are measured against the grid's own
 *   rectangle; the pointer is captured, and the moves and the release are
 *   heard on the grid, so a finger that leaves the block (or the board)
 *   keeps steering it, and an engine that refuses capture still reaches the
 *   grid by bubbling. A `pointercancel` is the platform taking the finger
 *   away: the block goes back to where it was pressed, and no move is made.
 *   A second finger during a drag does nothing. The click a drag leaves
 *   behind is spent, so a drag never also selects (issue #169).
 * - **Tap, then tap.** A tap selects a block (a thick frame, `aria-pressed`);
 *   the free cells on its lane get a dot, and a tap on one slides the block
 *   there. A tap on any other empty cell, or on the selected block again,
 *   lets go of it. The arrow buttons under the board are the third half of
 *   this path (screens/GameScreen.tsx).
 * - **Keys** are adapters over the same two calls, in screens/GameScreen.tsx.
 *
 * The drag lives in a ref, not in state: only the offset it draws is worth a
 * render, and nothing of it survives the release, the cancel, or an unmount.
 */
import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BOARD_SIZE, TARGET_INDEX, TARGET_ROW, slideRange, type Board } from '../../game';

/** How far a press must travel before it is a drag rather than a tap (§5). */
export const DRAG_THRESHOLD_PX = 8;

type Translate = ReturnType<typeof useSettings>['t'];

/**
 * A block's spoken name (§14): its kind, where it is (1-based, like the
 * screen), and how many free cells lie on each side of it along its lane.
 * One whole template per kind, never assembled from pieces.
 */
export function blockLabel(t: Translate, board: Board, index: number): string {
  const block = board.blocks[index]!;
  const position = board.positions[index]!;
  const range = slideRange(board, index);
  const before = position - range.min;
  const after = range.max - position;
  const from = position + 1;
  const to = position + block.length;
  if (index === TARGET_INDEX) {
    return t('unblockPuzzleBlockTarget', {
      row: block.lane + 1,
      from,
      to,
      left: before,
      right: after,
    });
  }
  return block.orientation === 'h'
    ? t('unblockPuzzleBlockH', { row: block.lane + 1, from, to, left: before, right: after })
    : t('unblockPuzzleBlockV', { col: block.lane + 1, from, to, up: before, down: after });
}

/** Where a block sits as grid coordinates, for drawing. */
function placement(board: Board, index: number, position = board.positions[index]!) {
  const block = board.blocks[index]!;
  const horizontal = block.orientation === 'h';
  return {
    x: horizontal ? position : block.lane,
    y: horizontal ? block.lane : position,
    w: horizontal ? block.length : 1,
    h: horizontal ? 1 : block.length,
  };
}

/**
 * The empty cells a selected block can be tapped to (§5), each mapped to the
 * offset the block would end on: a cell before the block brings its leading
 * end there, a cell after it brings its trailing end.
 */
export function destinationsOf(board: Board, index: number): Map<number, number> {
  const out = new Map<number, number>();
  const block = board.blocks[index];
  const position = board.positions[index];
  if (block === undefined || position === undefined) return out;
  const range = slideRange(board, index);
  const cellOf = (offset: number) =>
    block.orientation === 'h' ? block.lane * BOARD_SIZE + offset : offset * BOARD_SIZE + block.lane;
  for (let offset = range.min; offset < position; offset++) out.set(cellOf(offset), offset);
  for (let offset = position + block.length; offset < range.max + block.length; offset++) {
    out.set(cellOf(offset), offset - block.length + 1);
  }
  return out;
}

/** One press in progress. */
interface Drag {
  readonly pointerId: number;
  readonly block: number;
  readonly startX: number;
  readonly startY: number;
  /** One cell, in CSS pixels, measured on the press. 0 when the grid has no layout. */
  readonly cellPx: number;
  /** The block's offset when pressed, and how far it may go from there. */
  readonly from: number;
  readonly min: number;
  readonly max: number;
  /** True once the press has travelled past the threshold: a drag, no longer a tap. */
  moved: boolean;
  /** How far the block is drawn from `from`, in pixels along its lane. */
  offset: number;
}

/** What a drag in progress draws: one block, moved by some pixels along its lane. */
interface DragView {
  readonly block: number;
  readonly offset: number;
}

export interface BoardHint {
  readonly block: number;
  readonly to: number;
}

export interface UnblockBoardProps {
  board: Board;
  /** True once the target is at the exit: the board stops answering (§3). */
  solved: boolean;
  selected: number | null;
  hint: BoardHint | null;
  onSelect: (block: number | null) => void;
  /** One slide (§4). Returns whether it was made. */
  onSlide: (block: number, to: number) => boolean;
}

const blockFromEvent = (target: EventTarget): number | null => {
  const value = (target as HTMLElement).dataset?.block;
  if (value === undefined) return null;
  const index = Number(value);
  return Number.isInteger(index) ? index : null;
};

export const UnblockBoard = memo(function UnblockBoard({
  board,
  solved,
  selected,
  hint,
  onSelect,
  onSlide,
}: UnblockBoardProps) {
  const { t } = useSettings();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  /**
   * Set when a drag ends, so the click its release leaves on the block does
   * not also select it. Cleared on every press, so a press whose click never
   * came (a cancel) cannot swallow the next tap; and only a click that came
   * from a press (`detail > 0`) is ever swallowed — a keyboard activation
   * has none (docs/ARCHITECTURE.md「押下の記録は誰のものか」).
   */
  const draggedRef = useRef(false);
  const [dragView, setDragView] = useState<DragView | null>(null);

  // The board and the callbacks are read through refs in the handlers, so a
  // handler made for one render still acts on the board on screen.
  const boardRef = useRef(board);
  boardRef.current = board;
  const solvedRef = useRef(solved);
  solvedRef.current = solved;

  const onBlockPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    draggedRef.current = false;
    // The primary button only: nothing else means anything here.
    if (event.button !== 0 || solvedRef.current) return;
    const block = blockFromEvent(event.currentTarget);
    if (block === null) return;
    const current = dragRef.current;
    if (current !== null && current.pointerId !== event.pointerId) {
      // A second finger during a drag does nothing (§5) — unless it is a new
      // primary pointer, which means the first one is gone without a word
      // (its release went somewhere nobody heard). Then this press replaces it.
      if (event.isPrimary === false) return;
    }
    const grid = gridRef.current;
    const width = grid === null ? 0 : grid.getBoundingClientRect().width;
    const range = slideRange(boardRef.current, block);
    dragRef.current = {
      pointerId: event.pointerId,
      block,
      startX: event.clientX,
      startY: event.clientY,
      cellPx: width > 0 ? width / BOARD_SIZE : 0,
      from: boardRef.current.positions[block]!,
      min: range.min,
      max: range.max,
      moved: false,
      offset: 0,
    };
    setDragView(null);
    // Capture keeps the moves coming after the finger has left the block —
    // an improvement, never a precondition: it throws if the pointer is
    // already gone, and older engines may not have it at all.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works from the events that bubble to the grid.
    }
  }, []);

  /** Moves the block along its lane, inside its free cells. Heard on the grid. */
  const onGridPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    // A grid with no layout can say nothing honest about where a cell is.
    if (drag.cellPx <= 0) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const horizontal = boardRef.current.blocks[drag.block]?.orientation === 'h';
    // Across the lane means nothing; along it, the block stops at the free cells.
    const along = horizontal ? dx : dy;
    const lowest = (drag.min - drag.from) * drag.cellPx;
    const highest = (drag.max - drag.from) * drag.cellPx;
    const offset = Math.round(Math.min(highest, Math.max(lowest, along)));
    if (offset === drag.offset) return;
    drag.offset = offset;
    setDragView({ block: drag.block, offset });
  }, []);

  /** The release decides: the nearest cell, and a move if that is somewhere new (§4). */
  const onGridPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setDragView(null);
      if (!drag.moved) return;
      draggedRef.current = true;
      const steps = drag.cellPx > 0 ? Math.round(drag.offset / drag.cellPx) : 0;
      const to = Math.min(drag.max, Math.max(drag.min, drag.from + steps));
      if (to !== drag.from) onSlide(drag.block, to);
    },
    [onSlide],
  );

  /**
   * The platform took the finger (§5): no release and no click are coming.
   * The block goes back to where it was pressed, and nothing is recorded.
   */
  const onGridPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragView(null);
  }, []);

  /** A tap on a block: select it, or let go of it (§5). */
  const onBlockClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (event.detail > 0 && draggedRef.current) {
        draggedRef.current = false;
        return;
      }
      if (solvedRef.current) return;
      const block = blockFromEvent(event.currentTarget);
      if (block === null) return;
      onSelect(selected === block ? null : block);
    },
    [onSelect, selected],
  );

  const destinations = selected === null || solved ? null : destinationsOf(board, selected);

  /** A tap on an empty cell: slide the selected block there, or let go of it (§5). */
  const onCellClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (selected === null || solvedRef.current) return;
      const cell = Number((event.currentTarget as HTMLElement).dataset.cell);
      const to = destinationsOf(boardRef.current, selected).get(cell);
      if (to === undefined) {
        onSelect(null);
        return;
      }
      onSlide(selected, to);
    },
    [onSelect, onSlide, selected],
  );

  const occupied = new Set<number>();
  board.blocks.forEach((block, index) => {
    const position = board.positions[index]!;
    for (let k = 0; k < block.length; k++) {
      occupied.add(
        block.orientation === 'h'
          ? block.lane * BOARD_SIZE + position + k
          : (position + k) * BOARD_SIZE + block.lane,
      );
    }
  });

  const ghost = hint === null ? null : placement(board, hint.block, hint.to);

  return (
    <div
      className={`ub-board${solved ? ' ub-board-solved' : ''}`}
      role="group"
      aria-label={t('unblockPuzzleBoardLabel', {
        cols: BOARD_SIZE,
        rows: BOARD_SIZE,
        row: TARGET_ROW + 1,
      })}
    >
      <div
        className="ub-grid"
        ref={gridRef}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
        onPointerCancel={onGridPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, cell) => {
          const isDestination = destinations?.has(cell) === true && !occupied.has(cell);
          return (
            <div
              key={cell}
              className={`ub-cell${isDestination ? ' ub-cell-dest' : ''}`}
              data-cell={cell}
              aria-hidden="true"
              onClick={onCellClick}
            />
          );
        })}

        {board.blocks.map((block, index) => {
          const where = placement(board, index);
          const dragging = dragView !== null && dragView.block === index;
          const offset = dragging ? dragView.offset : 0;
          const isTarget = index === TARGET_INDEX;
          const classes = [
            'ub-block',
            isTarget ? 'ub-block-target' : `ub-block-${block.orientation}`,
            selected === index ? 'ub-block-selected' : '',
            hint?.block === index ? 'ub-block-hint' : '',
            dragging ? 'ub-block-dragging' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={index}
              type="button"
              className={classes}
              data-block={index}
              aria-label={blockLabel(t, board, index)}
              aria-pressed={selected === index}
              style={
                {
                  '--ub-x': where.x,
                  '--ub-y': where.y,
                  '--ub-w': where.w,
                  '--ub-h': where.h,
                  '--ub-dx': `${block.orientation === 'h' ? offset : 0}px`,
                  '--ub-dy': `${block.orientation === 'v' ? offset : 0}px`,
                } as CSSProperties
              }
              onPointerDown={onBlockPointerDown}
              onClick={onBlockClick}
            >
              {isTarget ? (
                <svg className="ub-target-mark" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 12h11M12 6l6 6-6 6" />
                </svg>
              ) : (
                <span className="ub-groove" aria-hidden="true" />
              )}
            </button>
          );
        })}

        {/* After the blocks, so it is drawn over them: a hinted slide shorter
            than the block ends partly on the block's own cells, and the whole
            outline has to show (§6). */}
        {ghost !== null ? (
          <div
            className="ub-ghost"
            aria-hidden="true"
            style={
              {
                '--ub-x': ghost.x,
                '--ub-y': ghost.y,
                '--ub-w': ghost.w,
                '--ub-h': ghost.h,
              } as CSSProperties
            }
          />
        ) : null}
      </div>

      {/* The exit: a gap in the frame at the right end of the target's row,
          and an arrow outside it (§1, §14). Decorative — the board's label
          says where it is. */}
      <span className="ub-exit" aria-hidden="true" />
      <svg className="ub-exit-mark" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5l7 7-7 7" />
      </svg>
    </div>
  );
});
