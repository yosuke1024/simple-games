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
import {
  memo,
  useCallback,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
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

  /**
   * Where the swipe being measured began, and which finger began it (§3).
   *
   * The id is what makes the reading belong to somebody: a second finger on
   * the board used to overwrite the starting point, so releasing the *first*
   * one measured a distance nobody travelled and slid a tile the player never
   * pushed (issue #187). One press is tracked at a time — the newest, because
   * a release can go missing entirely (a finger that leaves the board before
   * it lifts) and a record that outlived the next press would be worse than
   * one that is replaced by it.
   */
  const pointerRef = useRef<{ id: number; x: number; y: number } | null>(null);
  /** Set when a swipe has just played a move, so the click it precedes is not
   *  taken as a second move on whatever tile the finger happened to end on. */
  const swipedRef = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
      if (!start || start.id !== event.pointerId) return;
      pointerRef.current = null;
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

  /**
   * The platform took the finger away — the notification shade, an incoming
   * call, a palm, a scroll the browser claimed. No release is coming for this
   * pointer, so the reading is dropped and no tile slides: without this it
   * would sit here waiting to be measured against whatever released on the
   * board next (docs/ARCHITECTURE.md「指を取り上げられたときの契約」). The
   * mark a played swipe leaves is not touched — a cancelled press played no
   * swipe, and the click an *earlier* one left behind is still on its way.
   */
  const onPointerCancel = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  }, []);

  /**
   * A tap, unless it is the click the swipe just played left behind. The mark
   * is about the click a press leaves, and `detail` is the count of clicks in
   * that press: a keyboard activation has none, so it is never the click the
   * mark was left for. Without that half, a swipe released off a tile — in the
   * gaps, on the board's own padding — leaves the mark standing (no tile's
   * `onTap` ran to spend it) and eats the next Enter (issue #187). Solitaire /
   * FreeCell / Spider read `detail` for exactly this reason.
   */
  const onTap = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      if (event.detail > 0 && swipedRef.current) {
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
      onPointerCancel={onPointerCancel}
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
            onClick={(event) => onTap(event, index)}
          >
            <span className="slide-tile-face">{value}</span>
          </button>
        );
      })}
    </div>
  );
});
