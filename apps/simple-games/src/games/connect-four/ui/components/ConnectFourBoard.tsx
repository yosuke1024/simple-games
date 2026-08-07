/**
 * The 7×6 board (docs/CONNECT_FOUR_RULES.md §2, §10).
 *
 * Seven column buttons, not forty-two cell buttons: a drop is a column, so
 * that is what is pressed and what is announced. Each button reads out its
 * column from the bottom up, which is the order the discs are stacked, and a
 * full column is disabled rather than silently inert.
 *
 * The falling disc is CSS only: the newest disc starts translated up by the
 * rows it passed and slides down, keyed by the move counter so a disc drops
 * once and then stays put. The winning line is ringed and everything else
 * dimmed, so the result does not rely on colour alone (§10). Reduced Motion
 * turns the fall off and the disc is simply where it landed.
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { cellAt, COLS, dropRowOf, EMPTY, PLAYER, ROWS, rowOf, type Board } from '../../game';
import type { LastMove } from '../../state/GameContext';

/** Per row travelled, capped so a six-row fall is still brisk (§10). */
const FALL_MS_PER_ROW = 55;
const FALL_MS_MAX = 220;

/**
 * The distance actually travelled, handed to the keyframe: a disc that fell
 * one row must not take the same time as one that fell six (§10).
 */
const fallStyle = (cell: number): CSSProperties => {
  const rows = rowOf(cell) + 1;
  return {
    '--c4-fall-rows': rows,
    '--c4-fall-ms': `${Math.min(FALL_MS_MAX, rows * FALL_MS_PER_ROW)}ms`,
  } as CSSProperties;
};

export interface ConnectFourBoardProps {
  board: Board;
  /** False while a dialog is up or the match is over: nothing is droppable. */
  playing: boolean;
  lastMove: LastMove | null;
  winningLine: readonly number[] | null;
  onDrop: (col: number) => void;
}

export const ConnectFourBoard = memo(function ConnectFourBoard({
  board,
  playing,
  lastMove,
  winningLine,
  onDrop,
}: ConnectFourBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const winners = winningLine ? new Set(winningLine) : null;

  /** One column read from the bottom up — the order discs stack in (§10). */
  const columnLabel = (col: number): string => {
    const stack: string[] = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      const piece = board[cellAt(row, col)];
      if (piece === EMPTY) break;
      stack.push(piece === PLAYER ? t('fourDiscYou') : t('fourDiscCpu'));
    }
    return stack.length === 0
      ? t('fourColumnEmpty', { col: col + 1 })
      : t('fourColumnStack', { col: col + 1, stack: stack.join(', ') });
  };

  return (
    <div
      className={`c4-board ${reducedMotion ? 'c4-board-still' : ''}`}
      role="group"
      aria-label={t('fourBoardLabel')}
    >
      {Array.from({ length: COLS }, (_, col) => {
        const full = dropRowOf(board, col) < 0;
        return (
          <button
            key={col}
            type="button"
            className="c4-column"
            aria-label={columnLabel(col)}
            disabled={!playing || full}
            onClick={() => onDrop(col)}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const cell = cellAt(row, col);
              const piece = board[cell];
              const isLast = lastMove?.placed === cell;
              return (
                <span key={row} className="c4-slot">
                  {piece !== EMPTY ? (
                    <span
                      // Keyed by the move that put it here, so the fall
                      // keyframe plays on arrival and never again.
                      key={isLast ? lastMove.moveCount : -1}
                      className={[
                        'c4-disc',
                        piece === PLAYER ? 'c4-disc-you' : 'c4-disc-cpu',
                        isLast ? 'c4-disc-fall' : '',
                        winners ? (winners.has(cell) ? 'c4-disc-win' : 'c4-disc-dim') : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={isLast ? fallStyle(cell) : undefined}
                      aria-hidden="true"
                    >
                      {/* Inside the disc, so it falls with it: a mark drawn on
                          the slot would sit in an empty hole for the length of
                          the drop, waiting for its disc to arrive (§10). */}
                      {isLast ? <span className="c4-last-mark" /> : null}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
});
