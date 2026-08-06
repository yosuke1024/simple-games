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
 */
import { memo, useCallback, useEffect, useRef, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  colIndices,
  CROSSED,
  FILLED,
  lineSatisfied,
  rowIndices,
  type Hint,
  type NonogramSession,
} from '../../game';

/** Long enough not to fire while tapping, short enough not to feel stuck. */
export const LONG_PRESS_MS = 450;

export interface NonoBoardProps {
  session: NonogramSession;
  /** The last hint: a decided cell and its line, or a broken line (§7). */
  hint: Hint | null;
  /** When on, a tap crosses and a long press paints (§3). */
  xMode: boolean;
  onPaint: (index: number) => void;
  onCross: (index: number) => void;
}

const clueText = (clue: readonly number[]): string => (clue.length === 0 ? '0' : clue.join(' '));

export const NonoBoard = memo(function NonoBoard({
  session,
  hint,
  xMode,
  onPaint,
  onCross,
}: NonoBoardProps) {
  const { t } = useSettings();
  const { size, marks, clues } = session;

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

  const primary = useCallback(
    (index: number) => (xMode ? onCross(index) : onPaint(index)),
    [onCross, onPaint, xMode],
  );

  /** A long press: whichever of the two a tap did not do (§3). */
  const secondary = useCallback(
    (index: number) => (xMode ? onPaint(index) : onCross(index)),
    [onCross, onPaint, xMode],
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

      <div className="nono-cells">
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
              onPointerDown={() => onPointerDown(index)}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onPointerCancel={clearTimer}
              onContextMenu={(event) => event.preventDefault()}
              onClick={() => onClick(index)}
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
