/**
 * The nonogram board (docs/NONOGRAM_RULES.md §1, §3, §12).
 *
 * One button per cell, each carrying its state and position in its label, so a
 * screen reader can read the board rather than a wall of "button". Clues are
 * labelled per line; a satisfied clue dims and strikes through — opacity alone
 * would leave nothing for colour-blind players (§12).
 *
 * Input follows §3. A tap paints and a long press crosses; X mode swaps the
 * two, which is what makes the game playable one-handed and without a long
 * press at all.
 *
 * A press that then moves is a stroke (issue #108): it decides once what it
 * writes — the same thing a tap on the cell it began on would have written —
 * and writes exactly that to every cell it crosses. Nothing toggles inside a
 * stroke, so a finger that wanders back over its own path does not unpick it.
 * Moves are measured against the grid's own rectangle rather than handled per
 * cell, because a captured pointer stops visiting the cells it passes over.
 *
 * Where there is a mouse, the right button crosses (issue #112) — the second
 * mark without the mode the touch player needs. It is the one input that means
 * the same thing whichever way X mode has the tap, because a player who
 * reached for the right button asked for a cross, not for the other half of a
 * mode. It draws nothing: strokes stay the left button's (§3).
 */
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  colIndices,
  CROSSED,
  crossTarget,
  FILLED,
  lineSatisfied,
  paintTarget,
  rowIndices,
  type Hint,
  type Mark,
  type NonogramSession,
} from '../../game';

/** Long enough not to fire while tapping, short enough not to feel stuck. */
export const LONG_PRESS_MS = 450;

/**
 * How finely one pointer move is walked, in samples per cell. A flick sends a
 * single move across several cells, and painting only where the events landed
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
  /** What every cell of this stroke is set to, decided when it started. */
  mark: Mark;
  /**
   * The grid's rectangle, measured once. Reading it per move would force a
   * layout on every event, on top of the board React has just re-rendered —
   * and the grid cannot move under a finger that is drawing on it: the cells
   * refuse to pan (`touch-action: none`).
   */
  readonly rect: DOMRect;
  /** True once the finger has left `origin`: a stroke, no longer a tap. */
  started: boolean;
  /** The last sampled point, so a jump can be walked cell by cell. */
  x: number;
  y: number;
  /** Cells already settled — re-entering one writes nothing new. */
  readonly visited: Set<number>;
}

export interface NonoBoardProps {
  session: NonogramSession;
  /** The last hint: a decided cell and its line, or a broken line (§7). */
  hint: Hint | null;
  /** When on, a tap crosses and a long press paints (§3). */
  xMode: boolean;
  onPaint: (index: number) => void;
  onCross: (index: number) => void;
  /** A drag: the cells just crossed, and the one mark they all take (§3). */
  onStroke: (indices: readonly number[], mark: Mark) => void;
}

const clueText = (clue: readonly number[]): string => (clue.length === 0 ? '0' : clue.join(' '));

export const NonoBoard = memo(function NonoBoard({
  session,
  hint,
  xMode,
  onPaint,
  onCross,
  onStroke,
}: NonoBoardProps) {
  const { t } = useSettings();
  const { size, marks, clues } = session;

  const timerRef = useRef<number | null>(null);
  /**
   * The cell a long press, a stroke, or a right click has already acted on, so
   * the click that may follow does not act on it twice. The cell rather than a
   * bare flag: a right click leaves no click behind on most platforms, and a
   * mark that named no cell would sit there waiting to swallow an unrelated
   * one.
   */
  const handledRef = useRef<number | null>(null);
  /**
   * How the press in progress arrived. Touch raises a context menu of its own
   * at the end of a long press, and that one must not cross — the long press
   * already has.
   */
  const pointerTypeRef = useRef('mouse');
  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const primary = useCallback(
    (index: number) => (xMode ? onCross(index) : onPaint(index)),
    [onCross, onPaint, xMode],
  );

  /** A long press: whichever of the two a tap did not do (§3). */
  const secondary = useCallback(
    (index: number) => (xMode ? onPaint(index) : onCross(index)),
    [onCross, onPaint, xMode],
  );

  /** What a stroke from `index` writes — what a tap there would have (§3). */
  const primaryTarget = useCallback(
    (index: number): Mark => (xMode ? crossTarget(marks, index) : paintTarget(marks, index)),
    [marks, xMode],
  );

  /** The same question for the long press's action, for a stroke after one. */
  const secondaryTarget = useCallback(
    (index: number): Mark => (xMode ? paintTarget(marks, index) : crossTarget(marks, index)),
    [marks, xMode],
  );

  /**
   * Every cell the straight line between two samples passes through, in order.
   * Samples off the grid contribute nothing, so a finger that leaves the board
   * and comes back paints only the part of its path that was on it.
   *
   * Cell pitch is taken as the grid's width over its size — the 2px gutters
   * shift a boundary by less than one gutter, which is inside the gutter.
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

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, index: number) => {
      pointerTypeRef.current = event.pointerType;
      // The right button crosses on its context menu below, and draws nothing.
      // Arming a long press for it as well would act twice over one press —
      // once each — and take the cross straight back off.
      if (event.button !== 0) return;
      handledRef.current = null;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        handledRef.current = index;
        secondary(index);
        // Held long enough to cross, and still down: a drag from here carries
        // on with what the long press just did, rather than painting over it.
        const stroke = strokeRef.current;
        if (stroke !== null && stroke.origin === index) {
          stroke.mark = secondaryTarget(index);
          stroke.started = true;
        }
      }, LONG_PRESS_MS);
      const cells = cellsRef.current;
      strokeRef.current =
        cells === null
          ? null
          : {
              pointerId: event.pointerId,
              origin: index,
              mark: primaryTarget(index),
              rect: cells.getBoundingClientRect(),
              started: false,
              x: event.clientX,
              y: event.clientY,
              visited: new Set([index]),
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
    [clearTimer, primaryTarget, secondary, secondaryTarget],
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

      const fresh = crossed.filter((index) => !stroke.visited.has(index));
      if (fresh.length === 0) return;

      if (!stroke.started) {
        // The finger has reached a second cell, so the press was a stroke
        // after all: the cell it began on is written now, and the long press
        // and the click it would otherwise have ended in are both dropped.
        stroke.started = true;
        clearTimer();
        fresh.unshift(stroke.origin);
      }
      // The click a release leaves behind reaches a cell only as the one the
      // press began on: capture retargets it there, and without capture a
      // drag that ended elsewhere lands on the grid, which takes no clicks.
      handledRef.current = stroke.origin;
      for (const index of fresh) stroke.visited.add(index);
      onStroke(fresh, stroke.mark);
    },
    [cellsBetween, clearTimer, onStroke],
  );

  /**
   * A released or cancelled pointer ends the stroke where it stands. What it
   * has already written stays: the player watched every cell of it go down.
   * The long press is stopped by the cell's own handlers, which a captured
   * pointer's release and cancellation both still reach.
   */
  const onCellsPointerEnd = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (stroke === null || stroke.pointerId !== event.pointerId) return;
    strokeRef.current = null;
  }, []);

  /**
   * The right button (issue #112): the cross, either way round, whatever X
   * mode says. It never paints and never starts a stroke — one press, one
   * mark, the same one every time.
   */
  const onCellContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // Touch raises it at the end of a long press, which has crossed already;
      // crossing here as well would take that cross straight back off.
      if (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen') return;
      // macOS raises it from the primary button (ctrl+click), so a long press
      // may be armed, a stroke may be waiting on its first move, and a click
      // may still follow: drop the first two, and mark the cell so the third
      // paints nothing.
      clearTimer();
      strokeRef.current = null;
      handledRef.current = index;
      onCross(index);
    },
    [clearTimer, onCross],
  );

  /**
   * No browser menu anywhere over the board. Bound to the board rather than to
   * the cells because the gaps between them are a target too, and so are the
   * clues: crossing fast with the right button, a click that misses a cell by
   * a pixel would otherwise open the native menu over the board the player is
   * reading.
   */
  const onBoardContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      clearTimer();
      // The mark is about the click a press leaves behind, and `detail` is the
      // count of clicks in that press: a keyboard activation has none, and so
      // is never the click the mark was left for. Without that, a right click
      // — which most platforms never follow with a click — would leave its
      // mark standing and swallow the Enter a keyboard player pressed next.
      if (event.detail > 0 && handledRef.current === index) {
        handledRef.current = null;
        return;
      }
      primary(index);
    },
    [clearTimer, primary],
  );

  // The hint's line, spelled out as cell indices; empty when there is none.
  const hintLine =
    hint === null
      ? null
      : hint.kind === 'cell'
        ? hint.line
        : { axis: hint.axis, index: hint.index };
  const reason = new Set(
    hintLine === null
      ? []
      : hintLine.axis === 'row'
        ? rowIndices(size, hintLine.index)
        : colIndices(size, hintLine.index),
  );
  const broken = hint?.kind === 'contradiction';

  const rowDone = clues.rows.map((clue, i) => lineSatisfied(marks, rowIndices(size, i), clue));
  const colDone = clues.cols.map((clue, i) => lineSatisfied(marks, colIndices(size, i), clue));

  const clueClass = (axis: 'row' | 'col', i: number, done: boolean): string =>
    [
      'nono-clue',
      done ? 'nono-clue-done' : '',
      hintLine?.axis === axis && hintLine.index === i
        ? broken
          ? 'nono-clue-broken'
          : 'nono-clue-hint'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

  return (
    <div
      className="nono-board"
      role="group"
      aria-label={t('nonoBoardLabel', { size })}
      data-size={size}
      style={{ '--nono-size': size } as CSSProperties}
      onContextMenu={onBoardContextMenu}
    >
      <div className="nono-corner" aria-hidden="true" />

      <div className="nono-colclues">
        {clues.cols.map((clue, i) => (
          <div
            key={i}
            className={clueClass('col', i, colDone[i] ?? false)}
            role="img"
            aria-label={t('nonoColClueLabel', { n: i + 1, clue: clueText(clue) })}
          >
            {(clue.length === 0 ? [0] : clue).map((run, k) => (
              <span key={k}>{run}</span>
            ))}
          </div>
        ))}
      </div>

      <div className="nono-rowclues">
        {clues.rows.map((clue, i) => (
          <div
            key={i}
            className={clueClass('row', i, rowDone[i] ?? false)}
            role="img"
            aria-label={t('nonoRowClueLabel', { n: i + 1, clue: clueText(clue) })}
          >
            {(clue.length === 0 ? [0] : clue).map((run, k) => (
              <span key={k}>{run}</span>
            ))}
          </div>
        ))}
      </div>

      <div
        className="nono-cells"
        ref={cellsRef}
        onPointerMove={onCellsPointerMove}
        onPointerUp={onCellsPointerEnd}
        onPointerCancel={onCellsPointerEnd}
      >
        {marks.map((mark, index) => {
          const row = Math.floor(index / size);
          const col = index % size;
          const label =
            mark === FILLED
              ? t('nonoCellFilled', { row: row + 1, col: col + 1 })
              : mark === CROSSED
                ? t('nonoCellCrossed', { row: row + 1, col: col + 1 })
                : t('nonoCellBlank', { row: row + 1, col: col + 1 });
          const classes = [
            'nono-cell',
            mark === FILLED ? 'nono-cell-filled' : '',
            mark === CROSSED ? 'nono-cell-crossed' : '',
            // Guide lines every five cells keep a 10×10 countable at a glance.
            col > 0 && col % 5 === 0 ? 'nono-cell-guide-left' : '',
            row > 0 && row % 5 === 0 ? 'nono-cell-guide-top' : '',
            hint?.kind === 'cell' && hint.index === index ? 'nono-cell-hint' : '',
            reason.has(index) ? (broken ? 'nono-cell-broken' : 'nono-cell-reason') : '',
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
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onPointerCancel={clearTimer}
              onContextMenu={(event) => onCellContextMenu(event, index)}
              onClick={(event) => onClick(event, index)}
            >
              {mark === CROSSED ? (
                <span className="nono-glyph" aria-hidden="true">
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
