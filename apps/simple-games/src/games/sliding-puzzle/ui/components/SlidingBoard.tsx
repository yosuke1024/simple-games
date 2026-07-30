/**
 * The N x N board (docs/SLIDING_PUZZLE_RULES.md §1, §3, §12).
 *
 * Tiles are absolutely positioned and moved by transform, keyed by their
 * number, so React keeps the same element for a tile and the browser animates
 * it from its old cell to its new one. Reduced Motion turns the transition off
 * and the tile is simply in its new place (§12).
 *
 * Every tile — and the gap — carries its number (or "empty") plus its row and
 * column, because a board read aloud is unusable without positions.
 */
import { memo, useCallback, useRef, type CSSProperties, type PointerEvent } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { blankIndex, colOf, rowOf, solvedTiles, type Size, type Tiles } from '../../game';

export interface SlidingBoardProps {
  tiles: Tiles;
  size: Size;
  onTileTap: (index: number) => void;
}

/** How far a drag has to travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 24;

export const SlidingBoard = memo(function SlidingBoard({
  tiles,
  size,
  onTileTap,
}: SlidingBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const goal = solvedTiles(size);

  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** Set when a swipe has just played a move, so the click it precedes is not
   *  taken as a second move on whatever tile the finger happened to end on. */
  const swipedRef = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { x: event.clientX, y: event.clientY };
    swipedRef.current = false;
  }, []);

  /**
   * Swiping does the same thing as tapping (§3): a swipe towards the gap slides
   * the tile that is in the way of that direction. It is a convenience on top
   * of tapping, never the only way to play.
   */
  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = pointerRef.current;
      pointerRef.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;

      const blank = blankIndex(tiles);
      if (blank < 0) return;
      const row = rowOf(blank, size);
      const col = colOf(blank, size);

      let target: number | null = null;
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx > 0 && col > 0) target = blank - 1;
        if (dx < 0 && col < size - 1) target = blank + 1;
      } else {
        if (dy > 0 && row > 0) target = blank - size;
        if (dy < 0 && row < size - 1) target = blank + size;
      }
      if (target === null) return;
      swipedRef.current = true;
      onTileTap(target);
    },
    [onTileTap, size, tiles],
  );

  const onTap = useCallback(
    (index: number) => {
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      onTileTap(index);
    },
    [onTileTap],
  );

  return (
    <div
      className={`slide-board ${reducedMotion ? 'slide-board-still' : ''}`}
      data-size={size}
      role="group"
      aria-label={t('slideBoardLabel')}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {tiles.map((value, index) => {
        const row = rowOf(index, size);
        const col = colOf(index, size);
        const position = {
          '--slide-n': size,
          '--slide-row': row,
          '--slide-col': col,
        } as CSSProperties;

        // The gap is not a button: tapping it does nothing, and a control that
        // never responds is worse than no control. It is still announced.
        if (value === 0) {
          return (
            <div
              key="blank"
              className="slide-tile slide-tile-blank"
              style={position}
              role="img"
              aria-label={t('slideBlankLabel', { row: row + 1, col: col + 1 })}
            >
              <span className="slide-tile-face" />
            </div>
          );
        }

        const home = goal[index] === value;
        return (
          <button
            key={value}
            type="button"
            className={`slide-tile ${home ? 'slide-tile-home' : ''}`}
            style={position}
            aria-label={t('slideTileLabel', { value, row: row + 1, col: col + 1 })}
            onClick={() => onTap(index)}
          >
            <span className="slide-tile-face">{value}</span>
          </button>
        );
      })}
    </div>
  );
});
