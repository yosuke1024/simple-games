/**
 * The 8×8 board (docs/CHECKERS_RULES.md §1, §2, §6, §10).
 *
 * Sixty-four fixed buttons, of which only the thirty-two dark ones ever hold
 * anything. Tapping is two-stage: pick up one of your pieces, then put it
 * down on one of the squares that lights up. That is the whole interaction —
 * there is no drag, and no square is pressable unless it is a piece that can
 * move or a place the held piece may go.
 *
 * The capture obligation is enforced by what is offered rather than by an
 * error: while a jump exists anywhere, the pieces that cannot jump are simply
 * not pickable (§2). Nothing is refused, so nothing has to scold.
 *
 * The movement is CSS only: the piece that just arrived is keyed by the step
 * counter and slides in from where it came, the square a captured piece stood
 * on flashes once, and a crowning pops its ring. Reduced Motion turns all of
 * it off and the pieces are simply where they landed (§10).
 */
import { memo, type CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  CELL_COUNT,
  EMPTY,
  PLAYER,
  colOf,
  isDarkSquare,
  isKing,
  rowOf,
  sideOf,
  type Board,
  type Move,
} from '../../game';
import type { LastMove } from '../../state/GameContext';

/** Per square travelled, so a jump does not take a step's time (§10). */
const SLIDE_MS_PER_SQUARE = 110;
const SLIDE_MS_MAX = 220;

/**
 * The distance actually travelled, in square-widths, handed to the keyframe.
 * The piece starts where it came from and arrives where it is.
 */
function slideStyle(move: Move): CSSProperties {
  const squares = Math.abs(rowOf(move.to) - rowOf(move.from));
  return {
    '--ck-move-x': `${(colOf(move.from) - colOf(move.to)) * 100}%`,
    '--ck-move-y': `${(rowOf(move.from) - rowOf(move.to)) * 100}%`,
    '--ck-move-ms': `${Math.min(SLIDE_MS_MAX, squares * SLIDE_MS_PER_SQUARE)}ms`,
  } as CSSProperties;
}

export interface CheckersBoardProps {
  board: Board;
  /** The piece the player has picked up, or null (§2). */
  selected: number | null;
  /** Where the selected piece may go — empty while nothing is held. */
  targets: readonly number[];
  /** Which of the player's pieces can be picked up at all right now (§2). */
  movable: readonly number[];
  /** False while a dialog is up or the match is over: nothing is pressable. */
  playing: boolean;
  lastMove: LastMove | null;
  onSquare: (cell: number) => void;
}

export const CheckersBoard = memo(function CheckersBoard({
  board,
  selected,
  targets,
  movable,
  playing,
  lastMove,
  onSquare,
}: CheckersBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const targetSet = new Set(targets);
  const movableSet = new Set(movable);

  return (
    <div
      className={`ck-board ${reducedMotion ? 'ck-board-still' : ''}`}
      role="group"
      aria-label={t('checkersBoardLabel')}
    >
      {Array.from({ length: CELL_COUNT }, (_, cell) => {
        const piece = board[cell]!;
        const dark = isDarkSquare(cell);
        const row = rowOf(cell) + 1;
        const col = colOf(cell) + 1;
        const side = sideOf(piece);
        const isTarget = targetSet.has(cell);
        const isSelected = selected === cell;
        const pickable = movableSet.has(cell);
        const arrived = lastMove?.move.to === cell;
        const taken = lastMove?.move.captured === cell;

        // Read out as whose piece it is rather than what colour it is: which
        // side opened is the player's choice (§1), and "yours" is the thing a
        // listener needs to hear.
        const label = isTarget
          ? t('checkersSquareTarget', { row, col })
          : piece === EMPTY
            ? t('checkersSquareEmpty', { row, col })
            : side === PLAYER
              ? isSelected
                ? t('checkersSquareSelected', { row, col })
                : isKing(piece)
                  ? t('checkersSquareYourKing', { row, col })
                  : t('checkersSquareYourMan', { row, col })
              : isKing(piece)
                ? t('checkersSquareCpuKing', { row, col })
                : t('checkersSquareCpuMan', { row, col });

        return (
          <button
            key={cell}
            type="button"
            className={[
              'ck-square',
              dark ? 'ck-square-dark' : '',
              isSelected ? 'ck-square-selected' : '',
              taken ? 'ck-square-taken' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={label}
            aria-pressed={pickable || isSelected ? isSelected : undefined}
            disabled={!playing || (!isTarget && !pickable && !isSelected)}
            onClick={() => onSquare(cell)}
          >
            {piece !== EMPTY ? (
              <span
                // Keyed by the step that put it here, so a piece animates on
                // arrival and never again — including each jump of a
                // sequence, which is a new step and so a new element.
                key={arrived ? lastMove!.stepId : -1}
                className={[
                  'ck-piece',
                  side === PLAYER ? 'ck-piece-you' : 'ck-piece-cpu',
                  arrived ? 'ck-piece-move' : '',
                  arrived && lastMove!.crowned ? 'ck-piece-crowned' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={arrived ? slideStyle(lastMove!.move) : undefined}
                aria-hidden="true"
              >
                {isKing(piece) ? <span className="ck-king-ring" /> : null}
                {arrived ? <span className="ck-last-mark" /> : null}
              </span>
            ) : isTarget ? (
              <span className="ck-target-dot" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
