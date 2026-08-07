/**
 * The 8×8 board (docs/REVERSI_RULES.md §1, §7, §11).
 *
 * Sixty-four fixed buttons: a cell with a legal move is enabled and announces
 * "your move"; every other cell is disabled and announces what sits on it —
 * which is the only way a board makes sense aloud. Legal cells carry a quiet
 * dot: that is rule visibility, not advice (§7).
 *
 * The flip is CSS only. Discs the last move turned re-render with the new
 * colour under a half-turn keyframe, keyed by the move counter so the same
 * disc can flip again next move; the placed disc pops in; the last-placed
 * cell keeps a small mark so the CPU's reply can be found after looking away
 * (§11). Reduced Motion turns the movement off and the discs are simply in
 * their new state.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { BLACK, colOf, EMPTY, isLegalMove, rowOf, type Board, type Player } from '../../game';
import type { LastMove } from '../../state/GameContext';

export interface ReversiBoardProps {
  board: Board;
  /** The colour the player holds this match (§1). */
  playerColor: Player;
  /** Whose turn it is; legal cells are tappable only on the player's (§2). */
  toMove: Player;
  /** Ignored while the match is over or a dialog is up — the screen inerts. */
  playing: boolean;
  lastMove: LastMove | null;
  onPlace: (cell: number) => void;
}

export const ReversiBoard = memo(function ReversiBoard({
  board,
  playerColor,
  toMove,
  playing,
  lastMove,
  onPlace,
}: ReversiBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const playersTurn = playing && toMove === playerColor;
  const flipped = lastMove ? new Set(lastMove.flipped) : null;

  return (
    <div
      className={`rv-board ${reducedMotion ? 'rv-board-still' : ''}`}
      role="group"
      aria-label={t('reversiBoardLabel')}
    >
      {board.map((piece, cell) => {
        const row = rowOf(cell) + 1;
        const col = colOf(cell) + 1;
        const legal = playersTurn && piece === EMPTY && isLegalMove(board, playerColor, cell);
        // Read out as whose disc it is rather than what colour it is: the
        // player can be either colour (§1), and "yours" is the thing a
        // listener needs to hear.
        const label =
          piece === EMPTY
            ? legal
              ? t('reversiCellLegal', { row, col })
              : t('reversiCellEmpty', { row, col })
            : piece === playerColor
              ? t('reversiCellMine', { row, col })
              : t('reversiCellTheirs', { row, col });
        return (
          <button
            key={cell}
            type="button"
            className="rv-cell"
            aria-label={label}
            disabled={!legal}
            onClick={() => onPlace(cell)}
          >
            {piece !== EMPTY ? (
              <span
                // Keyed by the move that last touched this cell, so a disc
                // flipped twice in a match animates both times: a new key is
                // a new element, and the keyframe plays on arrival.
                key={flipped?.has(cell) || lastMove?.placed === cell ? lastMove!.moveCount : -1}
                className={[
                  'rv-disc',
                  piece === BLACK ? 'rv-disc-black' : 'rv-disc-white',
                  flipped?.has(cell) ? 'rv-disc-flip' : '',
                  lastMove?.placed === cell ? 'rv-disc-pop' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              >
                {/* Inside the disc, and drawn in the other disc's colour, so
                    the mark is legible on black and white alike — in both
                    themes, where an accent-coloured dot would not be (§11). */}
                {lastMove?.placed === cell ? <span className="rv-last-mark" /> : null}
              </span>
            ) : legal ? (
              <span className="rv-legal-dot" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
