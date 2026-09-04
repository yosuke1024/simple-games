/**
 * The minefield (docs/MINESWEEPER_RULES.md §1, §3, §12).
 *
 * One button per cell, each carrying its own state and position in its label,
 * so a screen reader can read the board rather than a wall of "button". The
 * number itself is the information; the colour is only there to make a glance
 * quicker, never to carry meaning on its own (§12).
 *
 * Input follows §3. A tap opens and a long press flags; flag mode swaps the
 * two, which is what makes the game playable one-handed and without a long
 * press at all. Tapping an open number chords it.
 *
 * Where there is a mouse, the right button flags too (issue #111) — the habit
 * every desktop Minesweeper has taught. It is the one input that means the
 * same thing whichever way flag mode has the tap, because a player who reached
 * for the right button asked for a flag, not for the other half of a mode.
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
import { useReducedMotion } from '@/ui/useReducedMotion';
import { canChord, cellViews, colOf, rowOf, type Board, type SafeCell } from '../../game';

/** Long enough not to fire while tapping, short enough not to feel stuck. */
export const LONG_PRESS_MS = 450;

export interface MinesBoardProps {
  board: Board;
  /** The last hint: the safe cell, plus the numbers that prove it (§7). */
  hint: SafeCell | null;
  /** When on, a tap flags and a long press opens (§3). */
  flagMode: boolean;
  onOpen: (index: number) => void;
  onFlag: (index: number) => void;
  onChord: (index: number) => void;
}

const NO_CELLS: ReadonlySet<number> = new Set();

export const MinesBoard = memo(function MinesBoard({
  board,
  hint,
  flagMode,
  onOpen,
  onFlag,
  onChord,
}: MinesBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const views = cellViews(board);
  const { width, height } = board.field;

  const timerRef = useRef<number | null>(null);
  /**
   * The cell a long press or a right click has already acted on, so the click
   * that may follow does not act on it twice. The cell rather than a bare flag:
   * a right click leaves no click behind on most platforms, and a mark that
   * named no cell would sit there waiting to swallow an unrelated one.
   */
  const handledRef = useRef<number | null>(null);
  /**
   * How the press in progress arrived. Touch raises a context menu of its own
   * at the end of a long press, and that one must not flag — the long press
   * already has.
   */
  const pointerTypeRef = useRef('mouse');

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  /** A tap: open, or flag when flag mode is on. An open number chords. */
  const primary = useCallback(
    (index: number) => {
      if (board.opened[index]) {
        if (canChord(board, index)) onChord(index);
        return;
      }
      if (flagMode) onFlag(index);
      else onOpen(index);
    },
    [board, flagMode, onChord, onFlag, onOpen],
  );

  /** A long press: whichever of the two a tap did not do (§3). */
  const secondary = useCallback(
    (index: number) => {
      if (board.opened[index]) return;
      if (flagMode) onOpen(index);
      else onFlag(index);
    },
    [board.opened, flagMode, onFlag, onOpen],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>, index: number) => {
      pointerTypeRef.current = event.pointerType;
      // The right button flags on its context menu below. Arming a long press
      // for it as well would act twice over one press — once each — and take
      // the flag straight back off.
      if (event.button !== 0) return;
      handledRef.current = null;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        handledRef.current = index;
        secondary(index);
      }, LONG_PRESS_MS);
    },
    [clearTimer, secondary],
  );

  /**
   * The right button (issue #111): the flag, either way round, whatever flag
   * mode says. An open number is left alone — chording is the tap's (§3).
   */
  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      // Touch raises it at the end of a long press, which has flagged already;
      // flagging here as well would take that flag straight back off.
      if (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen') return;
      // macOS raises it from the primary button (ctrl+click), so a long press
      // may be armed and a click may still follow: stop the one, and mark the
      // cell so the other neither opens nor chords it.
      clearTimer();
      handledRef.current = index;
      if (board.opened[index]) return;
      onFlag(index);
    },
    [board.opened, clearTimer, onFlag],
  );

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

  /**
   * No browser menu anywhere over the board. Bound to the grid rather than to
   * the squares because the gaps between them are a target too: flagging fast
   * with the right button, a click that misses a square by a pixel would
   * otherwise open the native menu over the board the player is reading.
   */
  const onBoardContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const hintCells = hint ? new Set(hint.reason) : NO_CELLS;

  return (
    <div
      className={`mines-board ${reducedMotion ? 'mines-board-still' : ''}`}
      role="group"
      aria-label={t('minesBoardLabel', { width, height })}
      style={{ '--mines-cols': width } as CSSProperties}
      onContextMenu={onBoardContextMenu}
    >
      {views.map((view, index) => {
        const row = rowOf(width, index) + 1;
        const col = colOf(width, index) + 1;

        const label =
          view.kind === 'flagged'
            ? t('minesCellFlagged', { row, col })
            : view.kind === 'mine'
              ? t('minesCellMine', { row, col })
              : view.kind === 'number'
                ? view.count === 0
                  ? t('minesCellEmpty', { row, col })
                  : t('minesCellNumber', { count: view.count, row, col })
                : t('minesCellHidden', { row, col });

        const classes = [
          'mines-cell',
          view.kind === 'number' ? 'mines-cell-open' : 'mines-cell-shut',
          view.kind === 'mine' ? 'mines-cell-mine' : '',
          view.kind === 'mine' && view.exploded ? 'mines-cell-blast' : '',
          hint?.index === index ? 'mines-cell-hint' : '',
          hintCells.has(index) ? 'mines-cell-reason' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={index}
            type="button"
            className={classes}
            data-count={view.kind === 'number' && view.count > 0 ? view.count : undefined}
            aria-label={label}
            onPointerDown={(event) => onPointerDown(event, index)}
            onPointerUp={clearTimer}
            onPointerLeave={clearTimer}
            onPointerCancel={clearTimer}
            onContextMenu={(event) => onContextMenu(event, index)}
            onClick={(event) => onClick(event, index)}
          >
            {view.kind === 'number' && view.count > 0 ? (
              view.count
            ) : view.kind === 'flagged' ? (
              <span className="mines-glyph" aria-hidden="true">
                ⚑
              </span>
            ) : view.kind === 'mine' ? (
              <span className="mines-glyph" aria-hidden="true">
                ✸
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
