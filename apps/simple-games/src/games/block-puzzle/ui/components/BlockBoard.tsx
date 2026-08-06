/**
 * The 8×8 board (docs/BLOCK_PUZZLE_RULES.md §1, §3, §12).
 *
 * Every cell is a button, always, and always announces whether it is filled
 * or empty — the board has to be readable before it can be played. A tap does
 * something only once a piece is selected (§3), which is the same two-step
 * shape Water Sort's tubes have: the control is live, it just needs the other
 * half of the gesture.
 *
 * A filled cell is painted as a solid square, never merely tinted, so the
 * state survives a screen read and a colour-blind eye alike (§12).
 *
 * Two marks are drawn on the same grid: the piece in hand, which is where the
 * carried piece is right now and whether it fits (§3), and the fade left
 * behind by a clear. The fade sits on cells the board has *already* emptied —
 * the position settles the moment the placement is committed, and the fade is
 * the trace of what was there, not a state the game is still in (§12).
 *
 * The piece in hand is drawn on the board's own grid rather than floating
 * under the finger, so what is on screen is exactly what a release would do.
 * It is drawn whether or not it fits: a preview that only appeared for legal
 * positions left the player with nothing to aim with at the moment they were
 * aiming, which is how this screen was wrong before (§3).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { colOf, rowOf, type Board } from '../../game';

export interface BlockBoardProps {
  board: Board;
  /** Board indices the carried piece covers, or empty while not dragging (§3). */
  hand: readonly number[];
  /** Whether releasing now would place the piece — it is drawn either way. */
  handFits: boolean;
  /** Board indices the lines this placement would take (§4), before it does. */
  willClear: readonly number[];
  /** Board indices the last clear emptied, for the fade (§12). */
  clearing: readonly number[];
  /** Where the piece that finished those lines landed — the fade runs out
   *  from there, so the placement and the clear read as one movement (§12). */
  clearFrom: { readonly row: number; readonly col: number } | null;
  onCellTap: (row: number, col: number) => void;
  /** Aiming for a device with a pointer; a finger never fires this (§3). */
  onCellHover: (row: number, col: number) => void;
  onLeave: () => void;
  boardRef: (element: HTMLDivElement | null) => void;
}

/** How much later each ring of cells leaves than the one inside it (§12). */
const CLEAR_STAGGER_MS = 20;

export const BlockBoard = memo(function BlockBoard({
  board,
  hand,
  handFits,
  willClear,
  clearing,
  clearFrom,
  onCellTap,
  onCellHover,
  onLeave,
  boardRef,
}: BlockBoardProps) {
  const { t } = useSettings();

  return (
    <div
      className="bp-board"
      ref={boardRef}
      role="group"
      aria-label={t('blockBoardLabel')}
      onPointerLeave={onLeave}
    >
      {board.map((filled, index) => {
        const row = rowOf(index);
        const col = colOf(index);
        const classes = ['bp-cell'];
        if (filled) classes.push('bp-cell-filled');
        if (hand.indexOf(index) !== -1) {
          classes.push(handFits ? 'bp-cell-ghost' : 'bp-cell-ghost-blocked');
        }
        if (willClear.indexOf(index) !== -1) classes.push('bp-cell-will-clear');
        const leaving = clearing.indexOf(index) !== -1;
        if (leaving) classes.push('bp-cell-clearing');
        // Chebyshev distance: the wave leaves as a square ring, which is what
        // a row and a column clearing together want — a straight-line measure
        // would make the crossing cell go twice.
        const delay =
          leaving && clearFrom
            ? Math.max(Math.abs(row - clearFrom.row), Math.abs(col - clearFrom.col)) *
              CLEAR_STAGGER_MS
            : 0;
        return (
          <button
            key={index}
            type="button"
            className={classes.join(' ')}
            style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
            onPointerEnter={(event) => {
              // Touch fires enter on contact; hover aiming is for devices
              // that can point without pressing.
              if (event.pointerType !== 'touch') onCellHover(row, col);
            }}
            // Announced 1-based: "row 0" reads like an error, not a corner.
            aria-label={
              filled
                ? t('blockCellFilled', { row: row + 1, col: col + 1 })
                : t('blockCellEmpty', { row: row + 1, col: col + 1 })
            }
            onClick={() => onCellTap(row, col)}
          />
        );
      })}
    </div>
  );
});
