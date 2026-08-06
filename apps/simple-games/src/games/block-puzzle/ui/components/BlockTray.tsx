/**
 * The three pieces on offer (docs/BLOCK_PUZZLE_RULES.md §1, §3).
 *
 * Each slot is one button, and it carries both ways in: a pointer press on it
 * starts a drag, and a plain activation selects it for the tap path. Keeping
 * them on the same control is the point — the tap path is how somebody who
 * cannot drag plays this game, not a fallback bolted next to the real one
 * (§3), so it has to be the same target, the same label, the same place.
 *
 * A spent slot stays in the row as a disabled button rather than disappearing:
 * the tray is three slots wide until the batch refills (§1), and a row that
 * reflows under the finger mid-batch would move the piece somebody was aiming
 * for.
 *
 * Pieces are drawn on their own 5×5 grid — the largest shape the catalogue
 * holds (§6) — so a 1×1 and a 3×3 are drawn to the same scale and the tray
 * shows how big a piece really is.
 */
import { memo, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { pieceById, type Tray } from '../../game';

/** The box every tray piece is drawn in: the catalogue's largest shape (§6). */
const PREVIEW_SIZE = 5;

export interface BlockTrayProps {
  tray: Tray;
  /**
   * Which batch these three came from. Only used as a key: a new batch
   * remounts the piece graphics, which is what lets a CSS keyframe play as
   * they arrive. Refilled pieces settle into the tray instead of appearing
   * there (§12).
   */
  batchIndex: number;
  /** The slot picked by the tap path, or null (§3). */
  selected: number | null;
  /** The slot currently under a finger, drawn as lifted out of the tray. */
  dragging: number | null;
  /** Starts a drag. Everything after the press is handled by the screen. */
  onSlotPointerDown: (event: PointerEvent<HTMLButtonElement>, slot: number) => void;
  onSlotActivate: (slot: number) => void;
}

export const BlockTray = memo(function BlockTray({
  tray,
  batchIndex,
  selected,
  dragging,
  onSlotPointerDown,
  onSlotActivate,
}: BlockTrayProps) {
  const { t } = useSettings();

  return (
    <div className="bp-tray" role="group" aria-label={t('blockTrayLabel')}>
      {tray.map((id, slot) => {
        const piece = pieceById(id);
        // Slots are announced 1-based, like the board's rows and columns.
        const n = slot + 1;
        if (piece === null) {
          return (
            <button
              key={slot}
              type="button"
              className="bp-slot bp-slot-used"
              aria-label={t('blockPieceUsed', { n })}
              disabled
            />
          );
        }

        const isSelected = selected === slot;
        const classes = ['bp-slot'];
        if (isSelected) classes.push('bp-slot-selected');
        if (dragging === slot) classes.push('bp-slot-dragging');

        return (
          <button
            key={slot}
            type="button"
            className={classes.join(' ')}
            aria-pressed={isSelected}
            aria-label={
              isSelected
                ? t('blockPieceSelected', { n })
                : t('blockPieceLabel', { n, cells: piece.cells.length })
            }
            onPointerDown={(event) => onSlotPointerDown(event, slot)}
            onClick={() => onSlotActivate(slot)}
          >
            <span key={batchIndex} className="bp-piece bp-piece-dealt" aria-hidden="true">
              {Array.from({ length: PREVIEW_SIZE * PREVIEW_SIZE }, (_, index) => {
                const row = Math.floor(index / PREVIEW_SIZE);
                const col = index % PREVIEW_SIZE;
                // Centred in the preview box so a small piece is not pinned
                // to a corner of a slot much bigger than itself.
                const offsetRow = row - Math.floor((PREVIEW_SIZE - piece.height) / 2);
                const offsetCol = col - Math.floor((PREVIEW_SIZE - piece.width) / 2);
                const filled = piece.cells.some(
                  (cell) => cell.row === offsetRow && cell.col === offsetCol,
                );
                return (
                  <span
                    key={index}
                    className={filled ? 'bp-piece-cell bp-piece-cell-filled' : 'bp-piece-cell'}
                  />
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
});
