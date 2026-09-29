/**
 * The Box Regions board (docs/BOX_REGIONS_RULES.md §4, §5, §13).
 *
 * One button per cell, each carrying its position, its box and its clue in
 * its label, so a screen reader can read the board rather than a wall of
 * "button".
 *
 * Every cell carries a tile on its own `::before` (`box-regions.css`). The
 * tile holds the box's tint (or nothing, for an unassigned cell) and, on a
 * side it shares with the same box, reaches 1px past the cell's own border
 * to paint over it, so the cells of one box meet without a seam. `cellEdges`
 * says which sides instead border another box, an unassigned cell or the
 * board's edge — there the tile stops short and both sides' borders turn
 * ink, drawing a line 2px wide between them (§5). Boxes are rectangles, so
 * those lines are always four straight sides. Colour is never the only
 * signal: strip the tint and the lines alone still read the boxes.
 *
 * Input follows §4. A press on any cell is one corner; the cell the finger is
 * over is the other, and the rectangle between them is previewed — in the
 * accent when it holds exactly one clue, in warn when it holds none or two.
 * Letting go draws it. A press that never left its cell is a tap instead:
 * the click decides (a box goes, or an undrawn clue becomes a 1×1). A press
 * that did leave is a stroke, and the click it leaves behind is swallowed so
 * a drag never also taps the cell it began on. Moves are measured against
 * the grid's own rectangle rather than handled per cell, because a captured
 * pointer stops visiting the cells it passes over, and a finger outside the
 * board is rounded to the nearest cell.
 *
 * A cancelled pointer — the OS taking the finger away — drops the stroke. A
 * rectangle is one decision made on release, and a release that never came
 * decided nothing: the preview goes and the board is as it was.
 */
import {
  memo,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  UNASSIGNED,
  previewDraw,
  regionCells,
  spanRect,
  violationsOf,
  type BoxRegionsSession,
  type Hint,
} from '../../game';
import { ShapeKindIcon } from './ShapeKindIcon';

/** How many tints the palette in box-regions.css holds (§5). */
export const TINT_COUNT = 8;

/** One press in progress. A ref, not state: only the preview it raises is drawn. */
interface Stroke {
  readonly pointerId: number;
  /** The cell the press began on — one corner. */
  readonly origin: number;
  /** The grid's rectangle, measured once (the cells refuse to pan). */
  readonly rect: DOMRect;
  /** The cell the finger is over now — the other corner. */
  current: number;
  /** True once the finger has left `origin`: a stroke, no longer a tap. */
  started: boolean;
}

/** The rectangle being dragged out, as its two corners. */
interface Preview {
  readonly from: number;
  readonly to: number;
}

export interface BoxRegionsBoardProps {
  session: BoxRegionsSession;
  /** The last hint: a wrong box, or a step with its reason (§6). */
  hint: Hint | null;
  /** A released stroke, corner to corner (§4). Returns whether anything was drawn. */
  onDraw: (from: number, to: number) => boolean;
  /** A tap on a cell (§4). */
  onTap: (index: number) => void;
  /** True the instant the board is solved, for the one-shot wash (common mechanism). */
  solved: boolean;
}

/** Region 0 is "A", region 1 "B", … — the same letters the save uses, read aloud. */
export const regionName = (region: number): string => String.fromCharCode(65 + region);

export interface CellEdges {
  readonly top: boolean;
  readonly right: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
}

/**
 * Which of a cell's four sides is a border (§5): the box on that side
 * differs from this cell's own — including "no box" standing in for an
 * unassigned cell. A side on the board's own edge is a border only when this
 * cell is assigned; an unassigned cell has nothing to draw a line against.
 */
export function cellEdges(
  regionAt: (index: number) => number,
  index: number,
  row: number,
  col: number,
  width: number,
  height: number,
): CellEdges {
  const self = regionAt(index);
  const side = (deltaRow: number, deltaCol: number): boolean => {
    const r = row + deltaRow;
    const c = col + deltaCol;
    if (r < 0 || r >= height || c < 0 || c >= width) return self !== UNASSIGNED;
    return self !== regionAt(r * width + c);
  };
  return { top: side(-1, 0), right: side(0, 1), bottom: side(1, 0), left: side(0, -1) };
}

const clamp = (value: number, max: number): number => Math.min(max, Math.max(0, value));

export const BoxRegionsBoard = memo(function BoxRegionsBoard({
  session,
  hint,
  onDraw,
  onTap,
  solved,
}: BoxRegionsBoardProps) {
  const { t } = useSettings();
  const { width, height, clues, assignment } = session;
  const violations = violationsOf(session);

  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  /**
   * The cell a stroke began on, so the click that may follow it does not tap
   * it. Cleared on every press, so a press whose click never came (a cancel)
   * cannot swallow the next one.
   */
  const handledRef = useRef<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  /** The cell under a point, rounded onto the board when the finger is off it (§4). */
  const cellAt = useCallback(
    (rect: DOMRect, x: number, y: number): number => {
      const col = clamp(Math.floor(((x - rect.left) / rect.width) * width), width - 1);
      const row = clamp(Math.floor(((y - rect.top) / rect.height) * height), height - 1);
      return row * width + col;
    },
    [height, width],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, index: number) => {
    handledRef.current = null;
    // The primary button only: nothing else means anything here (§4).
    if (event.button !== 0) return;
    const cells = cellsRef.current;
    if (cells === null) return;
    strokeRef.current = {
      pointerId: event.pointerId,
      origin: index,
      rect: cells.getBoundingClientRect(),
      current: index,
      started: false,
    };
    // Capture keeps the moves coming to this button — and so, by bubbling, to
    // the grid below — after the finger has left the cell. An improvement,
    // never a precondition: it throws if the pointer is already gone.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The stroke still works from the events we do get.
    }
  }, []);

  /** Moves the far corner. Bound to the grid: capture retargets moves to the origin cell. */
  const onCellsPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const stroke = strokeRef.current;
      if (stroke === null || stroke.pointerId !== event.pointerId) return;
      // A grid with no layout yet can say nothing honest about where a cell is.
      if (stroke.rect.width === 0 || stroke.rect.height === 0) return;
      const cell = cellAt(stroke.rect, event.clientX, event.clientY);
      if (cell === stroke.current && stroke.started) return;
      stroke.current = cell;
      if (!stroke.started) {
        if (cell === stroke.origin) return;
        // The finger has reached a second cell, so the press is a stroke: the
        // click its release leaves behind must not tap the origin.
        stroke.started = true;
        handledRef.current = stroke.origin;
      }
      setPreview({ from: stroke.origin, to: cell });
    },
    [cellAt],
  );

  /** The release decides: a started stroke draws its rectangle (§4). */
  const onCellsPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const stroke = strokeRef.current;
      if (stroke === null || stroke.pointerId !== event.pointerId) return;
      strokeRef.current = null;
      setPreview(null);
      if (!stroke.started) return;
      const to =
        stroke.rect.width === 0 || stroke.rect.height === 0
          ? stroke.current
          : cellAt(stroke.rect, event.clientX, event.clientY);
      onDraw(stroke.origin, to);
    },
    [cellAt, onDraw],
  );

  /**
   * The platform took the finger (§4): no release and no click are coming.
   * The stroke is dropped whole, and nothing is left armed behind it.
   */
  const onCellsPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
    setPreview(null);
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // `detail` is the click count of the press that made this click: a
      // keyboard activation has none, and so is never the click a drag left.
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

  // The rectangle being dragged out, and whether it would draw (§13).
  const drawing = preview === null ? null : previewDraw(session, preview.from, preview.to);
  const drawingRect = preview === null ? null : spanRect(preview.from, preview.to, width);
  const previewCells = new Set<number>(drawing?.cells ?? []);
  const previewClass = drawing?.region === null ? 'br-preview-bad' : 'br-preview-ok';

  const counts = clues.map((_, region) => regionCells(assignment, region).length);
  const regionAt = (index: number): number => assignment[index] ?? UNASSIGNED;

  return (
    <div
      className={`br-board${solved ? ' br-board-solved' : ''}`}
      role="group"
      aria-label={t('boxRegionsBoardLabel', { width, height })}
      style={{ '--br-cols': width, '--br-rows': height } as CSSProperties}
    >
      <div
        className="br-cells"
        ref={cellsRef}
        onPointerMove={onCellsPointerMove}
        onPointerUp={onCellsPointerUp}
        onPointerCancel={onCellsPointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        {assignment.map((region, index) => {
          const row = Math.floor(index / width);
          const col = index % width;
          const clueIndex = clues.findIndex((clue) => clue.index === index);
          const clue = clueIndex === -1 ? null : clues[clueIndex]!;
          const assigned = region !== UNASSIGNED;
          const position = { row: row + 1, col: col + 1 };
          const edges = cellEdges(regionAt, index, row, col, width, height);
          const count = clueIndex === -1 ? 0 : counts[clueIndex]!;

          let label = assigned
            ? t('boxRegionsCellAssigned', { ...position, region: regionName(region) })
            : t('boxRegionsCellEmpty', position);
          if (clue !== null) {
            if (clue.size !== null) {
              label += `, ${t('boxRegionsClueCount', { count, size: clue.size })}`;
            }
            label += `, ${t(`boxRegionsKind_${clue.kind}`)}`;
          }
          const broken = violations.cells[index] === true;
          if (broken) label += `, ${t('boxRegionsRuleBroken')}`;

          const inPreview = previewCells.has(index) && drawingRect !== null;
          const classes = [
            'br-cell',
            assigned ? `br-tint-${region % TINT_COUNT}` : '',
            edges.top ? 'br-edge-t' : '',
            edges.right ? 'br-edge-r' : '',
            edges.bottom ? 'br-edge-b' : '',
            edges.left ? 'br-edge-l' : '',
            broken ? 'br-cell-warn' : '',
            hintCells.has(index) ? 'br-cell-hint' : '',
            reasonCells.has(index) ? 'br-cell-reason' : '',
            wrongCells.has(index) ? 'br-cell-wrong' : '',
            inPreview ? `br-cell-preview ${previewClass}` : '',
            inPreview && row === drawingRect.top ? 'br-pv-t' : '',
            inPreview && col === drawingRect.left + drawingRect.width - 1 ? 'br-pv-r' : '',
            inPreview && row === drawingRect.top + drawingRect.height - 1 ? 'br-pv-b' : '',
            inPreview && col === drawingRect.left ? 'br-pv-l' : '',
          ]
            .filter(Boolean)
            .join(' ');

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
                <span className="br-clue" aria-hidden="true">
                  <ShapeKindIcon kind={clue.kind} />
                  {clue.size !== null ? (
                    <span className="br-clue-count">
                      {/* No box yet: just the number. A box: its count until it is the number (§5). */}
                      {count === 0 || count === clue.size ? clue.size : `${count}/${clue.size}`}
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
