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
 */
import { memo, useCallback, useEffect, useRef, type CSSProperties } from 'react';
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
  /** Set by the long press so the click that follows does not act twice. */
  const handledRef = useRef(false);

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
    (index: number) => {
      handledRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        handledRef.current = true;
        secondary(index);
      }, LONG_PRESS_MS);
    },
    [clearTimer, secondary],
  );

  const onClick = useCallback(
    (index: number) => {
      clearTimer();
      if (handledRef.current) {
        handledRef.current = false;
        return;
      }
      primary(index);
    },
    [clearTimer, primary],
  );

  const hintCells = hint ? new Set(hint.reason) : NO_CELLS;

  return (
    <div
      className={`mines-board ${reducedMotion ? 'mines-board-still' : ''}`}
      role="group"
      aria-label={t('minesBoardLabel', { width, height })}
      style={{ '--mines-cols': width } as CSSProperties}
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
            onPointerDown={() => onPointerDown(index)}
            onPointerUp={clearTimer}
            onPointerLeave={clearTimer}
            onPointerCancel={clearTimer}
            onContextMenu={(event) => event.preventDefault()}
            onClick={() => onClick(index)}
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
