/**
 * The Shape Regions board (docs/SHAPE_REGIONS_RULES.md §4, §5, §13).
 *
 * One button per cell, each carrying its position, its region and its clue
 * in its label, so a screen reader can read the board rather than a wall of
 * "button". Regions show as a muted tint AND a thick border along every edge
 * where the region changes, so colour is never the only signal (§13).
 *
 * Input follows §4. A press on a cell that belongs to a region starts a
 * stroke: every cell the finger crosses is offered to that region, in order,
 * and the game decides which of them join (they must touch the region as it
 * grows). A tap on a region's cell takes it back. A press that then moves is
 * a stroke, not a tap: the click it leaves behind is swallowed, so a drag
 * never also removes the cell it began on. Moves are measured against the
 * grid's own rectangle rather than handled per cell, because a captured
 * pointer stops visiting the cells it passes over (the Nonogram pattern).
 *
 * A cancelled pointer — the OS taking the finger away — ends the stroke where
 * it stands. What has already joined stays: the player watched it go down.
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
import {
  UNASSIGNED,
  regionCells,
  violationsOf,
  type Hint,
  type ShapeRegionsSession,
} from '../../game';
import { ShapeIcon } from './ShapeIcon';

/** How many tints the palette in shape-regions.css holds (§5). */
export const TINT_COUNT = 8;

/**
 * How finely one pointer move is walked, in samples per cell. A flick sends a
 * single move across several cells, and offering only where the events landed
 * would leave holes in the run; two samples per cell cannot skip one.
 */
const STROKE_SAMPLES_PER_CELL = 2;

/** One drag in progress. A ref, not state: none of it is drawn. */
interface Stroke {
  readonly pointerId: number;
  /** The cell the press began on. */
  readonly origin: number;
  /** The region the stroke feeds — the origin's. */
  readonly region: number;
  /** The grid's rectangle, measured once (the cells refuse to pan). */
  readonly rect: DOMRect;
  /** True once the finger has left `origin`: a stroke, no longer a tap. */
  started: boolean;
  /** True once a move of this stroke has written a cell — the undo step is open (§6). */
  wrote: boolean;
  /** The last sampled point, so a jump can be walked cell by cell. */
  x: number;
  y: number;
}

export interface ShapeRegionsBoardProps {
  session: ShapeRegionsSession;
  /** The last hint: a wrong region, or a step with its reason (§6). */
  hint: Hint | null;
  /**
   * A stroke's cells offered to a region. `extend` is true for every move
   * after the first that wrote something. Returns whether anything joined.
   */
  onStroke: (region: number, cells: readonly number[], extend: boolean) => boolean;
  /** A tap on a cell (§4). */
  onTap: (index: number) => void;
}

/** Region 0 is "A", region 1 "B", … — the same letters the save uses, read aloud. */
export const regionName = (region: number): string => String.fromCharCode(65 + region);

export const ShapeRegionsBoard = memo(function ShapeRegionsBoard({
  session,
  hint,
  onStroke,
  onTap,
}: ShapeRegionsBoardProps) {
  const { t } = useSettings();
  const { width, height, clues, assignment } = session;
  const violations = violationsOf(session);

  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  /**
   * The cell a stroke has already acted on, so the click that may follow does
   * not act on it twice. Cleared on every press, so a press whose click never
   * came (a cancel) cannot swallow the next one.
   */
  const handledRef = useRef<number | null>(null);

  /**
   * Every cell the straight line between two samples passes through, in
   * order. Samples off the grid contribute nothing, so a finger that leaves
   * the board and comes back offers only the part of its path that was on it.
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

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, index: number) => {
      handledRef.current = null;
      // The primary button only: nothing else means anything here.
      if (event.button !== 0) return;
      const region = assignment[index] ?? UNASSIGNED;
      const cells = cellsRef.current;
      // A stroke feeds a region, so it can only begin on one (§4).
      if (region === UNASSIGNED || cells === null) {
        strokeRef.current = null;
        return;
      }
      strokeRef.current = {
        pointerId: event.pointerId,
        origin: index,
        region,
        rect: cells.getBoundingClientRect(),
        started: false,
        wrote: false,
        x: event.clientX,
        y: event.clientY,
      };
      // Capture keeps the moves coming to this button — and so, by bubbling,
      // to the grid below — after the finger has left the cell. An
      // improvement, never a precondition: it throws if the pointer is
      // already gone, and the moves that stay over the board arrive anyway.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The stroke still works from the events we do get.
      }
    },
    [assignment],
  );

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
      const offered = crossed.filter((index) => index !== stroke.origin);
      if (offered.length === 0) return;

      if (!stroke.started) {
        // The finger has reached a second cell, so the press was a stroke
        // after all: the click a release leaves behind must not remove the
        // cell it began on. Capture retargets that click to the origin.
        stroke.started = true;
        handledRef.current = stroke.origin;
      }
      // Cells are offered again on every pass on purpose: one that did not
      // touch the region a moment ago may touch it now that a neighbour has
      // joined, and the game skips what is already in.
      if (onStroke(stroke.region, offered, stroke.wrote)) stroke.wrote = true;
    },
    [cellsBetween, onStroke],
  );

  /**
   * A released or cancelled pointer ends the stroke where it stands. What it
   * has already written stays; a cancel is the platform saying no release and
   * no click are coming, and it leaves nothing armed behind it.
   */
  const onCellsPointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // The mark is about the click a press leaves behind, and `detail` is the
      // count of clicks in that press: a keyboard activation has none, and so
      // is never the click the mark was left for.
      if (event.detail > 0 && handledRef.current === index) {
        handledRef.current = null;
        return;
      }
      onTap(index);
    },
    [onTap],
  );

  // What the hint points at (§6).
  const hintCells = new Set<number>(hint?.kind === 'step' ? hint.step.cells : []);
  const reasonCells = new Set<number>(hint?.kind === 'step' ? hint.step.reason : []);
  const wrongCells = new Set<number>(hint?.kind === 'wrong' ? hint.cells : []);

  const counts = clues.map((_, region) => regionCells(assignment, region).length);

  return (
    <div
      className="sr-board"
      role="group"
      aria-label={t('shapeRegionsBoardLabel', { width, height })}
      style={{ '--sr-cols': width, '--sr-rows': height } as CSSProperties}
    >
      <div
        className="sr-cells"
        ref={cellsRef}
        onPointerMove={onCellsPointerMove}
        onPointerUp={onCellsPointerEnd}
        onPointerCancel={onCellsPointerEnd}
      >
        {assignment.map((region, index) => {
          const row = Math.floor(index / width);
          const col = index % width;
          const clueIndex = clues.findIndex((clue) => clue.index === index);
          const clue = clueIndex === -1 ? null : clues[clueIndex]!;
          const assigned = region !== UNASSIGNED;
          const position = { row: row + 1, col: col + 1 };

          // Thick edges where the region changes (§5): the top and left of
          // every cell, plus the outer right and bottom, so each shared edge
          // is drawn once.
          const above = row === 0 ? UNASSIGNED : assignment[index - width]!;
          const left = col === 0 ? UNASSIGNED : assignment[index - 1]!;
          const edgeTop = assigned || above !== UNASSIGNED ? region !== above : false;
          const edgeLeft = assigned || left !== UNASSIGNED ? region !== left : false;
          const edgeRight = col === width - 1 && assigned;
          const edgeBottom = row === height - 1 && assigned;

          let label = assigned
            ? t('shapeRegionsCellAssigned', { ...position, region: regionName(region) })
            : t('shapeRegionsCellEmpty', position);
          if (clue !== null) {
            if (clue.size !== null) {
              label += `, ${t('shapeRegionsClueCount', { count: counts[clueIndex]!, size: clue.size })}`;
            }
            if (clue.shape !== null) label += `, ${t(`shapeRegionsShape_${clue.shape}`)}`;
          }
          const broken = violations.cells[index] === true;
          if (broken) label += `, ${t('shapeRegionsRuleBroken')}`;

          const classes = [
            'sr-cell',
            assigned ? `sr-tint-${region % TINT_COUNT}` : '',
            edgeTop ? 'sr-edge-t' : '',
            edgeLeft ? 'sr-edge-l' : '',
            edgeRight ? 'sr-edge-r' : '',
            edgeBottom ? 'sr-edge-b' : '',
            broken ? 'sr-cell-warn' : '',
            hintCells.has(index) ? 'sr-cell-hint' : '',
            reasonCells.has(index) ? 'sr-cell-reason' : '',
            wrongCells.has(index) ? 'sr-cell-wrong' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const count = clueIndex === -1 ? 0 : counts[clueIndex]!;

          return (
            <button
              key={index}
              type="button"
              className={classes}
              aria-label={label}
              onPointerDown={(event) => onPointerDown(event, index)}
              onClick={(event) => onClick(event, index)}
            >
              {clue !== null ? (
                <span className="sr-clue" aria-hidden="true">
                  {clue.shape !== null ? <ShapeIcon category={clue.shape} /> : null}
                  {clue.size !== null ? (
                    <span className="sr-clue-count">
                      {count === clue.size ? clue.size : `${count}/${clue.size}`}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
