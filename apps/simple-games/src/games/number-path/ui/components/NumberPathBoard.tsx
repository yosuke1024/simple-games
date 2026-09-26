/**
 * The Number Path board (docs/NUMBER_PATH_RULES.md §1, §4, §11).
 *
 * One button per cell, each carrying its position, its number and where it
 * stands on the path in its label, so a screen reader can read the board
 * rather than a wall of "button". The path is drawn as thick segments from
 * each cell's centre towards the cells before and after it; walls as thick
 * edges; numbers as ASCII digits on a disc that fills once the path has been
 * through them. DOM and CSS only — nothing here is a canvas.
 *
 * Input is §4. A press that then moves is a stroke: every cell it passes is
 * handed to the game in order (`onTrace`), and the game reads each one the
 * same way a tap would — cut back to it if it is on the path, step onto it
 * if it can, otherwise nothing. Moves are measured against the grid's own
 * rectangle rather than handled per cell, because a captured pointer stops
 * visiting the cells it passes over, and a fast flick sends one move across
 * several cells: the straight line between two samples is walked cell by
 * cell so none is skipped (`cellsBetween`, the shape Nonogram uses).
 *
 * One gesture is one undo step (§5): the first trace of a stroke that
 * changes anything opens it (`newStroke`), and every later trace of the same
 * stroke joins it. A release or a cancel ends the stroke where it stands —
 * what was drawn stays (§4) — and the click a drag leaves behind on the cell
 * it began on is spent, not played as a tap.
 */
import {
  memo,
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { colOf, rowOf, type Hint, type NumberPathSession } from '../../game';
import { cellClasses, cellView, pathPositions } from './cellView';

/**
 * How finely one pointer move is walked, in samples per cell. Two samples
 * per cell cannot skip one, whatever the speed of the flick.
 */
const STROKE_SAMPLES_PER_CELL = 2;

/**
 * One drag in progress. A ref, not state: none of it is drawn, and it does
 * not survive the pointer being released or cancelled.
 */
interface Stroke {
  readonly pointerId: number;
  /** The cell the press began on. It is traced first once the stroke starts. */
  readonly origin: number;
  /** The grid's rectangle, measured once — the grid cannot move under a finger (`touch-action: none`). */
  readonly rect: DOMRect;
  /** True once the finger has left `origin`: a stroke, no longer a tap. */
  started: boolean;
  /** True once a trace of this stroke changed the path: its undo step is open. */
  committed: boolean;
  /** The last sampled point, so a jump can be walked cell by cell. */
  x: number;
  y: number;
  /** The last cell handed to the game, so a finger resting on it hands it over once. */
  last: number;
}

export interface NumberPathBoardProps {
  session: NumberPathSession;
  /** The last hint: the next cell, or the cell to back up to (§5). */
  hint: Hint | null;
  /**
   * The cells a stroke passed through, in order; `newStroke` on the first
   * trace of a gesture that has not yet changed the path. Returns whether
   * the path changed.
   */
  onTrace: (cells: readonly number[], newStroke: boolean) => boolean;
  /** A tap: a press that did not move (§4). */
  onTap: (index: number) => void;
}

export const NumberPathBoard = memo(function NumberPathBoard({
  session,
  hint,
  onTrace,
  onTap,
}: NumberPathBoardProps) {
  const { t } = useSettings();
  const { board, path } = session;
  const { width, height } = board;

  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  /**
   * The cell whose click a stroke has already accounted for, so the click the
   * release leaves behind does not act on it twice. The cell rather than a
   * bare flag, so a mark that named no cell cannot sit waiting to swallow an
   * unrelated click.
   */
  const handledRef = useRef<number | null>(null);

  /**
   * Every cell the straight line between two samples passes through, in
   * order. Samples off the grid contribute nothing, so a finger that leaves
   * the board and comes back traces only the part of its path that was on it.
   */
  const cellsBetween = useCallback(
    (rect: DOMRect, fromX: number, fromY: number, toX: number, toY: number): number[] => {
      const cellWidth = rect.width / width;
      const cellHeight = rect.height / height;
      const fromCol = (fromX - rect.left) / cellWidth;
      const fromRow = (fromY - rect.top) / cellHeight;
      const toCol = (toX - rect.left) / cellWidth;
      const toRow = (toY - rect.top) / cellHeight;
      const span = Math.max(Math.abs(toCol - fromCol), Math.abs(toRow - fromRow));
      const steps = Math.max(1, Math.ceil(span * STROKE_SAMPLES_PER_CELL));
      const out: number[] = [];
      let previous = -1;
      for (let step = 1; step <= steps; step++) {
        const col = Math.floor(fromCol + ((toCol - fromCol) * step) / steps);
        const row = Math.floor(fromRow + ((toRow - fromRow) * step) / steps);
        if (col < 0 || col >= width || row < 0 || row >= height) continue;
        const index = row * width + col;
        if (index === previous) continue;
        previous = index;
        out.push(index);
      }
      return out;
    },
    [height, width],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, index: number) => {
    // The primary button, or a finger or a pen tip. Nothing else draws.
    if (event.button !== 0) return;
    handledRef.current = null;
    const cells = cellsRef.current;
    strokeRef.current =
      cells === null
        ? null
        : {
            pointerId: event.pointerId,
            origin: index,
            rect: cells.getBoundingClientRect(),
            started: false,
            committed: false,
            x: event.clientX,
            y: event.clientY,
            last: index,
          };
    // Capture keeps the moves coming to this button — and so, by bubbling, to
    // the grid below — after the finger has left the cell. An improvement,
    // never a precondition: it throws if the pointer is already gone, and the
    // moves that stay over the board arrive anyway.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The stroke still works from the events we do get.
    }
  }, []);

  /**
   * Bound to the grid, not to the cell the press began on: pointer capture
   * retargets every move to that cell, and they bubble here from it.
   */
  const onCellsPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const stroke = strokeRef.current;
      if (stroke === null || stroke.pointerId !== event.pointerId) return;
      // A grid with no layout yet can say nothing honest about where a cell is.
      if (stroke.rect.width === 0 || stroke.rect.height === 0) return;

      const crossed = cellsBetween(stroke.rect, stroke.x, stroke.y, event.clientX, event.clientY);
      stroke.x = event.clientX;
      stroke.y = event.clientY;

      const fresh: number[] = [];
      for (const index of crossed) {
        if (index === stroke.last) continue;
        stroke.last = index;
        fresh.push(index);
      }
      if (fresh.length === 0) return;

      if (!stroke.started) {
        // The finger has reached a second cell, so the press was a stroke
        // after all: the cell it began on is traced first, and the click the
        // release would otherwise leave on it is spent.
        stroke.started = true;
        handledRef.current = stroke.origin;
        fresh.unshift(stroke.origin);
      }
      if (onTrace(fresh, !stroke.committed)) stroke.committed = true;
    },
    [cellsBetween, onTrace],
  );

  /**
   * A released or cancelled pointer ends the stroke where it stands. What it
   * has already drawn stays: the player watched every cell of it go down, and
   * taking it back is Undo's job, not the platform's (§4).
   */
  const onCellsPointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // `detail` is the count of clicks in this press: a keyboard activation
      // has none, and so is never the click a stroke left behind.
      if (event.detail > 0 && handledRef.current === index) {
        handledRef.current = null;
        return;
      }
      onTap(index);
    },
    [onTap],
  );

  /** No browser menu over the board: a long touch mid-stroke is not a request for one. */
  const onContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const positions = pathPositions(board, path);
  // The cells past the one the hint says to back up to: the stretch that left
  // the road, drawn in the warning colour as well as ending at the ring (§11).
  const astrayFrom = hint?.kind === 'back' ? positions[hint.cell]! : -1;

  return (
    <div
      className="np-board"
      role="group"
      aria-label={t('numberPathBoardLabel', { width, height })}
      style={{ '--np-cols': width, '--np-rows': height } as CSSProperties}
      onContextMenu={onContextMenu}
    >
      <div
        className="np-cells"
        ref={cellsRef}
        onPointerMove={onCellsPointerMove}
        onPointerUp={onCellsPointerEnd}
        onPointerCancel={onCellsPointerEnd}
      >
        {board.numbers.map((_, index) => {
          const view = cellView(board, path, positions, index);
          const position = { row: rowOf(index, width) + 1, col: colOf(index, width) + 1 };
          const base =
            view.number === 0
              ? t('numberPathCellPlain', position)
              : t('numberPathCellNumber', { n: view.number, ...position });
          const state =
            view.step >= 0
              ? t('numberPathOnPath', { step: view.step + 1 })
              : t('numberPathOffPath');
          const hinted = hint?.cell === index;
          const classes = [
            ...cellClasses(view),
            hinted ? 'np-cell-hint' : '',
            astrayFrom >= 0 && view.step > astrayFrom ? 'np-cell-astray' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={index}
              type="button"
              className={classes}
              aria-label={
                hinted ? `${base}, ${state}, ${t('numberPathHintMarked')}` : `${base}, ${state}`
              }
              onPointerDown={(event) => onPointerDown(event, index)}
              onClick={(event) => onClick(event, index)}
            >
              {view.walls.map((side) => (
                <span key={side} className={`np-wall np-wall-${side}`} aria-hidden="true" />
              ))}
              {view.segments.map((side) => (
                <span key={side} className={`np-seg np-seg-${side}`} aria-hidden="true" />
              ))}
              {view.isEnd ? <span className="np-end" aria-hidden="true" /> : null}
              {view.number !== 0 ? (
                <span className="np-digit" aria-hidden="true">
                  {view.number}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
