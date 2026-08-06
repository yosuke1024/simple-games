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
 * Two marks are drawn on the same grid: the drag ghost, which shows where a
 * legal drop would land (§3), and the fade left behind by a clear. The fade
 * sits on cells the board has *already* emptied — the position settles the
 * moment the placement is committed, and the fade is the trace of what was
 * there, not a state the game is still in (§12).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { colOf, rowOf, type Board } from '../../game';

export interface BlockBoardProps {
  board: Board;
  /** Board indices a legal drop would fill, or empty while not dragging (§3). */
  ghost: readonly number[];
  /** Board indices the last clear emptied, for the fade (§12). */
  clearing: readonly number[];
  onCellTap: (row: number, col: number) => void;
  boardRef: (element: HTMLDivElement | null) => void;
}

export const BlockBoard = memo(function BlockBoard({
  board,
  ghost,
  clearing,
  onCellTap,
  boardRef,
}: BlockBoardProps) {
  const { t } = useSettings();

  return (
    <div className="bp-board" ref={boardRef} role="group" aria-label={t('blockBoardLabel')}>
      {board.map((filled, index) => {
        const row = rowOf(index);
        const col = colOf(index);
        const classes = ['bp-cell'];
        if (filled) classes.push('bp-cell-filled');
        if (ghost.indexOf(index) !== -1) classes.push('bp-cell-ghost');
        if (clearing.indexOf(index) !== -1) classes.push('bp-cell-clearing');
        return (
          <button
            key={index}
            type="button"
            className={classes.join(' ')}
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
