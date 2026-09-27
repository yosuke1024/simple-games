/**
 * The Crown Grid board (docs/CROWN_GRID_RULES.md §1, §4, §5, §13).
 *
 * One button per cell, each carrying its mark, its position and its region in
 * its label, so a screen reader can read the board rather than a wall of
 * "button". A region is one rounded tile per cell, drawn on `::before` and
 * inset by `--cg-gap` on every side that meets another region or the board's
 * edge, so same-region tiles run together into one shape and different
 * regions read as a 2px ink seam whether or not their tints can be told apart
 * (§13). The tint is support, never the only signal.
 *
 * Input follows §4. A tap cycles empty → × → crown → empty. A press that then
 * moves is a stroke: it writes × onto every empty cell it crosses — the cell
 * it began on included, once the finger reaches a second one — and nothing
 * else. Crowns and existing ×s are never touched by a stroke, so a finger
 * wandering back over its own path unpicks nothing. Moves are measured
 * against the grid's own rectangle rather than handled per cell, because a
 * captured pointer stops visiting the cells it passes over (Nonogram's board
 * is the model). A `pointercancel` ends the stroke where it stands; what it
 * wrote stays. The click a stroke's release leaves behind is spent, so a drag
 * never also taps its origin.
 *
 * Violations show all the time (§5), and they are a statement about the
 * rules, never a comparison against the hidden answer.
 */
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useTransientTimeout } from '@/ui/useTransientTimeout';
import {
  colOf,
  CROSS,
  CROWN,
  houseIndices,
  neighbours,
  rowOf,
  violationsOf,
  type CrownGridSession,
  type Hint,
  type Mark,
} from '../../game';
import { CrownGlyph } from './CrownGlyph';
import { tileClasses } from '../tileClasses';

/** How long the row/column/region/8-neighbour flash lasts (§13, "reach"). */
const REACH_MS = 700;

/**
 * How finely one pointer move is walked, in samples per cell. A flick sends a
 * single move across several cells, and marking only where the events landed
 * would leave holes in the run; two samples per cell cannot skip one.
 */
const STROKE_SAMPLES_PER_CELL = 2;

/**
 * One drag in progress. A ref, not state: none of it is drawn, and it does not
 * survive the pointer being released or cancelled.
 */
interface Stroke {
  readonly pointerId: number;
  /** The cell the press began on. It joins the stroke only once one starts. */
  readonly origin: number;
  /** The grid's rectangle, measured once: the cells refuse to pan under a finger. */
  readonly rect: DOMRect;
  /** True once the finger has reached a second cell: a stroke, no longer a tap. */
  started: boolean;
  /** The last sampled point, so a jump can be walked cell by cell. */
  x: number;
  y: number;
  /** Cells already crossed — re-entering one writes nothing new. */
  readonly visited: Set<number>;
}

export interface CrownGridBoardProps {
  session: CrownGridSession;
  /** The last hint: a step with its reasons, a wrong crown, or a broken rule (§6). */
  hint: Hint | null;
  /** True for the one beat between the winning crown and the result card. */
  solved: boolean;
  onTap: (index: number) => void;
  /** A drag: the cells just crossed, in order. The game writes × on the empty ones (§4). */
  onStroke: (indices: readonly number[]) => void;
}

export const CrownGridBoard = memo(function CrownGridBoard({
  session,
  hint,
  solved,
  onTap,
  onStroke,
}: CrownGridBoardProps) {
  const { t } = useSettings();
  const { size, regions, marks } = session;
  const violations = violationsOf(session);

  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const reachTimeout = useTransientTimeout();
  /** The previous render's marks, to notice a crown that was *just* placed. */
  const previousMarksRef = useRef<readonly Mark[] | null>(null);
  /**
   * Cells lit for the 700ms "reach" of a crown just placed (§13), with a
   * generation that flips parity on every placement. A cell can be lit by
   * two placements in a row (rows, columns and regions overlap), and a bare
   * `Set` swap leaves its `cg-cell-reach` class untouched when that happens,
   * so the CSS animation never restarts — the cell just carries on its first
   * flash. The generation's parity picks between two rules with identical
   * keyframes under different names (`cg-reach` / `cg-reach-b`), and it is
   * the animation-name change, not the class name, that forces a restart.
   */
  const [reach, setReach] = useState<{ cells: ReadonlySet<number>; gen: number }>(() => ({
    cells: new Set(),
    gen: 0,
  }));

  // A crown that appears where the previous render had none lights the house
  // it now rules out — its row, column, region and 8 neighbours — for one
  // beat, so placing it reads as an action with a consequence rather than a
  // mark that quietly appeared. Exactly one new crown, never a bulk change
  // (a fresh board, a restore): those have nothing to "just place".
  useEffect(() => {
    const previous = previousMarksRef.current;
    previousMarksRef.current = marks;
    if (previous === null || previous.length !== marks.length) return;
    let placed = -1;
    for (let index = 0; index < marks.length; index++) {
      if (marks[index] === CROWN && previous[index] !== CROWN) {
        if (placed !== -1) {
          placed = -1;
          break;
        }
        placed = index;
      }
    }
    if (placed === -1) return;

    const lit = new Set<number>();
    const region = regions[placed] ?? 0;
    for (const index of houseIndices(size, regions, { kind: 'row', index: rowOf(placed, size) })) {
      lit.add(index);
    }
    for (const index of houseIndices(size, regions, { kind: 'col', index: colOf(placed, size) })) {
      lit.add(index);
    }
    for (const index of houseIndices(size, regions, { kind: 'region', index: region })) {
      lit.add(index);
    }
    for (const index of neighbours(placed, size)) lit.add(index);
    lit.delete(placed);

    setReach((previousReach) => ({ cells: lit, gen: previousReach.gen + 1 }));
    reachTimeout(
      () => setReach((previousReach) => ({ cells: new Set(), gen: previousReach.gen })),
      REACH_MS,
    );
  }, [marks, regions, size, reachTimeout]);

  /**
   * The cell whose click a stroke has already spoken for, so the click that
   * follows the release does not tap it too. The cell rather than a bare flag:
   * a mark that named no cell would sit there waiting to swallow an unrelated
   * one.
   */
  const handledRef = useRef<number | null>(null);

  /**
   * Every cell the straight line between two samples passes through, in order.
   * Samples off the grid contribute nothing, so a finger that leaves the board
   * and comes back marks only the part of its path that was on it.
   */
  const cellsBetween = useCallback(
    (rect: DOMRect, fromX: number, fromY: number, toX: number, toY: number): number[] => {
      const width = rect.width / size;
      const height = rect.height / size;
      const fromCol = (fromX - rect.left) / width;
      const fromRow = (fromY - rect.top) / height;
      const toCol = (toX - rect.left) / width;
      const toRow = (toY - rect.top) / height;
      const span = Math.max(Math.abs(toCol - fromCol), Math.abs(toRow - fromRow));
      const steps = Math.max(1, Math.ceil(span * STROKE_SAMPLES_PER_CELL));
      const out: number[] = [];
      let previous = -1;
      for (let step = 1; step <= steps; step++) {
        const col = Math.floor(fromCol + ((toCol - fromCol) * step) / steps);
        const row = Math.floor(fromRow + ((toRow - fromRow) * step) / steps);
        if (col < 0 || col >= size || row < 0 || row >= size) continue;
        const index = row * size + col;
        if (index === previous) continue;
        previous = index;
        out.push(index);
      }
      return out;
    },
    [size],
  );

  const onPointerDown = useCallback((event: PointerEvent<HTMLButtonElement>, index: number) => {
    // Only the primary press arms anything: not a middle button, not a pen's
    // eraser end. Nothing here has a second meaning for the right button.
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
            x: event.clientX,
            y: event.clientY,
            visited: new Set([index]),
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

      const fresh = crossed.filter((index) => !stroke.visited.has(index));
      if (fresh.length === 0) return;

      if (!stroke.started) {
        // The finger has reached a second cell, so the press was a stroke
        // after all: the cell it began on is crossed now too (§4), and the
        // click it would otherwise have ended in is dropped.
        stroke.started = true;
        fresh.unshift(stroke.origin);
      }
      handledRef.current = stroke.origin;
      for (const index of fresh) stroke.visited.add(index);
      onStroke(fresh);
    },
    [cellsBetween, onStroke],
  );

  /**
   * A released or cancelled pointer ends the stroke where it stands. What it
   * has already written stays: the player watched every × of it go down. A
   * cancel — the shade coming down, a palm, a pen leaving range — is the
   * platform saying no release is coming, so it must end the stroke too, or
   * the next press would find one still armed (issue #169).
   */
  const onCellsPointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // The mark is about the click a stroke leaves behind, and `detail` is
      // the count of clicks in that press: a keyboard activation has none, and
      // so is never the click the mark was left for.
      if (event.detail > 0 && handledRef.current === index) {
        handledRef.current = null;
        return;
      }
      onTap(index);
    },
    [onTap],
  );

  // What the hint points at (§6): the cells it settles, the candidates that
  // carry the proof, the houses they were read off — or the crowns at fault.
  const targets = new Set<number>();
  const support = new Set<number>();
  const reason = new Set<number>();
  const broken = new Set<number>();
  if (hint?.kind === 'violation') {
    for (const index of hint.cells) broken.add(index);
  } else if (hint?.kind === 'wrong') {
    broken.add(hint.index);
  } else if (hint?.kind === 'step') {
    for (const index of hint.step.cells) targets.add(index);
    for (const index of hint.step.support) support.add(index);
    for (const house of hint.step.houses) {
      for (const index of houseIndices(size, regions, house)) reason.add(index);
    }
  }
  // Everything the hint's reasoning does not touch fades behind a paper veil
  // while a hint is showing (§6, §13), so the houses and cells it does touch
  // read at full strength instead of competing with the board's own tints.
  const involved = new Set<number>([...reason, ...support, ...targets, ...broken]);

  // Row-major order among crowns only, for the solved settle's stagger (§13,
  // "--cg-i"). Never more than the board's own size, so 9 at most.
  const crownOrder = new Map<number, number>();
  for (let index = 0; index < marks.length; index++) {
    if (marks[index] === CROWN) crownOrder.set(index, crownOrder.size);
  }

  return (
    <div
      className={solved ? 'cg-board cg-board-solved' : 'cg-board'}
      role="group"
      aria-label={t('crownGridBoardLabel', { size })}
      style={{ '--cg-size': size } as CSSProperties}
    >
      <div
        className="cg-cells"
        ref={cellsRef}
        onPointerMove={onCellsPointerMove}
        onPointerUp={onCellsPointerEnd}
        onPointerCancel={onCellsPointerEnd}
      >
        {marks.map((mark, index) => {
          const row = rowOf(index, size);
          const col = colOf(index, size);
          const region = regions[index] ?? 0;
          const position = { row: row + 1, col: col + 1, region: region + 1 };
          const base =
            mark === CROWN
              ? t('crownGridCellCrown', position)
              : mark === CROSS
                ? t('crownGridCellCross', position)
                : t('crownGridCellEmpty', position);
          const isBroken = violations.cells[index] === true;
          const classes = [
            'cg-cell',
            ...tileClasses(index, size, (at) => regions[at] ?? 0),
            isBroken ? 'cg-cell-broken' : '',
            reach.cells.has(index) ? 'cg-cell-reach' : '',
            reach.cells.has(index) && reach.gen % 2 === 1 ? 'cg-cell-reach-odd' : '',
            targets.has(index) ? 'cg-cell-hint' : '',
            support.has(index) ? 'cg-cell-support' : '',
            reason.has(index) ? 'cg-cell-reason' : '',
            broken.has(index) ? 'cg-cell-hint-broken' : '',
            hint !== null && !involved.has(index) ? 'cg-cell-dim' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={index}
              type="button"
              className={classes}
              data-region={region}
              aria-label={isBroken ? `${base}, ${t('crownGridRuleBroken')}` : base}
              onPointerDown={(event) => onPointerDown(event, index)}
              onClick={(event) => onClick(event, index)}
            >
              {mark === CROWN ? (
                <span
                  key={mark}
                  className="cg-glyph cg-glyph-crown"
                  aria-hidden="true"
                  style={{ '--cg-i': crownOrder.get(index) ?? 0 } as CSSProperties}
                >
                  <CrownGlyph />
                </span>
              ) : mark === CROSS ? (
                <span key={mark} className="cg-glyph cg-glyph-cross" aria-hidden="true">
                  ×
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});
