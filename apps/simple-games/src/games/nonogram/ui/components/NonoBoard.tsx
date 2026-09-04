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
 * mode. Held down and moved, it crosses the whole run (issue #130): the other
 * half of the desktop board's "left paints, right crosses", and the last
 * place a nonogram player was still made to visit X mode to cross a line.
 * A pen's barrel button is the right button here too — pressed while hovering
 * it arrives as button 2, and held as the tip comes down it arrives inside
 * `buttons` instead, because what changed then was the contact.
 *
 * That gives one right press two possible writers, because the browsers
 * disagree on when the context menu belongs to it: macOS raises it on the way
 * down, before anyone can know a stroke is coming, and Windows only once the
 * button is back up, when the stroke is already over. Where the menu comes
 * first it crosses the cell the press began on, and the stroke that may follow
 * writes that same cell the same way. Where it comes last, a stroke that has
 * drawn swallows it — from the window, because a run drawn to the end of a row
 * is let go past the last cell as often as not, and the menu is then raised
 * somewhere the board never sees (§3).
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
  /**
   * True when the right button (or a pen's barrel) started it. Such a stroke
   * crosses and never paints, and the context menu of the press that started
   * it must not end it — on macOS that menu arrives first (§3).
   */
  readonly right: boolean;
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
  /**
   * Whether the press in progress is the right button's — a pen's barrel
   * counts. This is how the menu a barrel raises is told apart from the one a
   * pen's tip raises at the end of a long press, which has crossed already.
   */
  const rightPressRef = useRef(false);
  /** Whether this press has had its context menu yet (macOS raises it first). */
  const menuSeenRef = useRef(false);
  /**
   * Whether a context menu still to come belongs to a right stroke that has
   * already crossed its cells, and so has nothing left to say. It outlives the
   * release on purpose: Windows raises that menu only after the button comes
   * back up, when the stroke itself is already gone.
   */
  const swallowMenuRef = useRef(false);
  const cellsRef = useRef<HTMLDivElement | null>(null);
  const strokeRef = useRef<Stroke | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /**
   * The menu a finished right stroke leaves behind, wherever it lands. A run
   * drawn to the end of a row is let go past the last cell as often as not,
   * and the board's own handler covers only the board — a pixel to its right
   * is the screen behind it, where the native menu would open over the puzzle
   * the player is reading. Caught on the window, in the capture phase, so it
   * is stopped before it can reach a cell and cross one more.
   */
  useEffect(() => {
    const swallow = (event: Event) => {
      if (!swallowMenuRef.current) return;
      swallowMenuRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('contextmenu', swallow, true);
    return () => window.removeEventListener('contextmenu', swallow, true);
  }, []);

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
   * And for the right button's, which is the cross wherever X mode stands —
   * the same answer a right click on that cell alone would have given (§3).
   */
  const rightTarget = useCallback((index: number): Mark => crossTarget(marks, index), [marks]);

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
      // The button that changed is the right one when the hand pressed it, and
      // the contact when a pen's barrel was already held as the tip came down
      // — so ask what is down, not only what moved. A mouse's left press
      // carries `buttons` 1 and is not caught by it.
      const right = event.button === 2 || (event.buttons & 2) !== 0;
      rightPressRef.current = right;
      menuSeenRef.current = false;
      // Cleared on the way down rather than on release, because on Windows the
      // menu arrives after the release and would find the answer thrown away.
      swallowMenuRef.current = false;
      // Nothing else means anything here — not the middle button, not a pen's
      // eraser end.
      if (event.button !== 0 && !right) return;
      handledRef.current = null;
      clearTimer();
      // No long press under the right button. Windows raises its menu only
      // once the button is back up, so a timer would cross on its own and the
      // menu would take that cross straight back off, over one single press.
      if (!right) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          handledRef.current = index;
          secondary(index);
          // Held long enough to cross, and still down: a drag from here
          // carries on with what the long press just did, rather than
          // painting over it.
          const stroke = strokeRef.current;
          if (stroke !== null && stroke.origin === index) {
            stroke.mark = secondaryTarget(index);
            stroke.started = true;
          }
        }, LONG_PRESS_MS);
      }
      const cells = cellsRef.current;
      strokeRef.current =
        cells === null
          ? null
          : {
              pointerId: event.pointerId,
              origin: index,
              right,
              mark: right ? rightTarget(index) : primaryTarget(index),
              rect: cells.getBoundingClientRect(),
              started: false,
              x: event.clientX,
              y: event.clientY,
              visited: new Set([index]),
            };
      // Capture keeps the moves coming to this button — and so, by bubbling,
      // to the grid below — after the finger has left the cell. An
      // improvement, never a precondition: it throws if the pointer is
      // already gone, and the moves that stay over the board arrive anyway. The
      // right button takes it as well now, so a press held on its way off the
      // board keeps the pointer to this cell until it is let go — nothing
      // outside the board sees it pass.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The stroke still works from the events we do get.
      }
    },
    [clearTimer, primaryTarget, rightTarget, secondary, secondaryTarget],
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
        // A right press that has drawn answers its own context menu — but
        // only one that is still to come. Where the menu came first (macOS) it
        // has already crossed the cell this stroke began on, and nothing is
        // owed; leaving the flag up there would swallow an unrelated menu.
        if (stroke.right && !menuSeenRef.current) swallowMenuRef.current = true;
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
   * The right button (issues #112, #130): the cross, either way round,
   * whatever X mode says. One press, one mark — and where the press goes on to
   * draw a run, this is the cell it began on, written the same way the stroke
   * will write it.
   */
  const onCellContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // A menu owed to a stroke never gets here: the window swallows it above.
      // Touch and a pen's tip both raise a menu at the end of a long press,
      // which has crossed already; crossing here as well would take that cross
      // straight back off. A pen's barrel is not that press — it is the right
      // button, and it arms no long press.
      if (
        !rightPressRef.current &&
        (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen')
      ) {
        return;
      }
      // macOS raises it from the primary button (ctrl+click), so a long press
      // may be armed, a stroke may be waiting on its first move, and a click
      // may still follow: drop the first two, and mark the cell so the third
      // paints nothing. A right button's own stroke is left standing — macOS
      // raises this menu on the way down, before the hand has said whether it
      // meant one cross or a run, and dropping it there would put the right
      // button back where #112 left it. What that stroke goes on to write to
      // this cell is the mark being written here, so the two agree.
      clearTimer();
      if (strokeRef.current?.right !== true) strokeRef.current = null;
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
    // Every menu raised over the board passes here, the ones that came from a
    // cell included: it is where a press learns that its menu has been and
    // gone, and so that a stroke starting now is owed no second one.
    menuSeenRef.current = true;
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
