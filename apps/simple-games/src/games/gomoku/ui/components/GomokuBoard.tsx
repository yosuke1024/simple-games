/**
 * The 15×15 board (docs/GOMOKU_RULES.md §1, §2, §10).
 *
 * Two hundred and twenty-five fixed buttons. Every empty crossing is legal on
 * the player's turn, so the announcement is what the crossing holds rather
 * than whether it may be played.
 *
 * Placing takes two taps (§2). The first marks the crossing with a ghost of
 * the stone about to go down; the second commits it, and tapping elsewhere
 * moves the mark. On the narrowest phone the series supports, a crossing is
 * about nineteen pixels across — one tap would be a machine for placing
 * stones nobody meant to place.
 *
 * The placement animation is CSS only, keyed by the move counter so a stone
 * pops on arrival and never again; the winning line is ringed and everything
 * else dimmed, so the result does not rest on colour alone. Reduced Motion
 * turns the pop off and the stone is simply where it landed (§10).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { BLACK, CELL_COUNT, EMPTY, SIZE, colOf, rowOf, type Board, type Player } from '../../game';
import type { LastMove } from '../../state/GameContext';

/** The five marked crossings a 15×15 board carries. */
const STARS = new Set([3 * SIZE + 3, 3 * SIZE + 11, 7 * SIZE + 7, 11 * SIZE + 3, 11 * SIZE + 11]);

export interface GomokuBoardProps {
  board: Board;
  /** The colour the player holds this match (§1). */
  playerColor: Player;
  /** The crossing awaiting its second tap, or null (§2). */
  pending: number | null;
  /** False while a dialog is up or the match is over: nothing is pressable. */
  playing: boolean;
  lastMove: LastMove | null;
  winningLine: readonly number[] | null;
  onPoint: (cell: number) => void;
}

export const GomokuBoard = memo(function GomokuBoard({
  board,
  playerColor,
  pending,
  playing,
  lastMove,
  winningLine,
  onPoint,
}: GomokuBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const winners = winningLine ? new Set(winningLine) : null;

  return (
    <div
      className={`gm-board ${reducedMotion ? 'gm-board-still' : ''}`}
      role="group"
      aria-label={t('gomokuBoardLabel')}
    >
      {Array.from({ length: CELL_COUNT }, (_, cell) => {
        const piece = board[cell]!;
        const row = rowOf(cell);
        const col = colOf(cell);
        const isPending = pending === cell;
        // Read out as whose stone it is rather than what colour it is: the
        // player can hold either colour (§1), and "yours" is the thing a
        // listener needs to hear.
        const label = isPending
          ? t('gomokuPointPending', { row: row + 1, col: col + 1 })
          : piece === EMPTY
            ? t('gomokuPointEmpty', { row: row + 1, col: col + 1 })
            : piece === playerColor
              ? t('gomokuPointMine', { row: row + 1, col: col + 1 })
              : t('gomokuPointTheirs', { row: row + 1, col: col + 1 });

        return (
          <button
            key={cell}
            type="button"
            className={[
              'gm-point',
              row === 0 ? 'gm-point-first-row' : '',
              row === SIZE - 1 ? 'gm-point-last-row' : '',
              col === 0 ? 'gm-point-first-col' : '',
              col === SIZE - 1 ? 'gm-point-last-col' : '',
              STARS.has(cell) ? 'gm-point-star' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={label}
            disabled={!playing || piece !== EMPTY}
            onClick={() => onPoint(cell)}
          >
            {STARS.has(cell) && piece === EMPTY && !isPending ? (
              <span className="gm-star" aria-hidden="true" />
            ) : null}
            {piece !== EMPTY ? (
              <span
                // Keyed by the move that put it here, so the pop plays on
                // arrival and never again.
                key={lastMove?.placed === cell ? lastMove.moveCount : -1}
                className={[
                  'gm-stone',
                  piece === BLACK ? 'gm-stone-black' : 'gm-stone-white',
                  lastMove?.placed === cell ? 'gm-stone-pop' : '',
                  winners ? (winners.has(cell) ? 'gm-stone-win' : 'gm-stone-dim') : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {lastMove?.placed === cell ? <span className="gm-last-mark" /> : null}
              </span>
            ) : isPending ? (
              <span
                className={`gm-ghost ${playerColor === BLACK ? 'gm-ghost-black' : 'gm-ghost-white'}`}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
