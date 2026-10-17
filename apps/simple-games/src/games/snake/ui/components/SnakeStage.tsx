/**
 * The board on the game screen: the drawing, its name for a screen reader,
 * and the swipe (docs/SNAKE_RULES.md §13「操作」).
 *
 * The swipe belongs to one finger. `pointerdown` records where it started
 * and which pointer started it, and only that pointer's moves are measured
 * (a newer press takes the record over). It does not wait for the release:
 * as soon as the same pointer's
 * `pointermove` has travelled 24px along its longer axis, that direction is
 * entered, and the point it reached becomes the new start — so one finger
 * held down can turn again and again (an L, a U) without lifting. Same-way
 * and straight-back entries are the queue's to drop (§5), exactly as for a
 * button. `pointerup` and `pointercancel` end the record; a cancel before
 * the threshold enters nothing, and one after it takes nothing back — what
 * was entered is already queued, like a button press.
 *
 * The whole stage hears the swipe, the margins around a letterboxed board
 * included, and it is `touch-action: none` so the page never scrolls under
 * the finger. Nothing inside it, or laid over it, hears a click: Start and
 * Resume are the cross's middle button (SnakePad.tsx), so the board is a
 * surface to swipe and to look at, whole, in every state (§13).
 */
import { memo, useCallback, useRef, type PointerEvent } from 'react';
import type { Crash, Direction, RunStatus } from '../../game';
import { SnakeBoard } from './SnakeBoard';

/** How far a finger travels before it counts as a swipe — 2048's distance (§13). */
export const SWIPE_THRESHOLD_PX = 24;

export interface SnakeStageProps {
  body: readonly number[];
  food: number;
  direction: Direction;
  status: RunStatus;
  crash: Crash | null;
  pending: Direction | null;
  /** The board's accessible name: its size and where the run stands. */
  label: string;
  onSwipe: (direction: Direction) => void;
}

interface Track {
  readonly id: number;
  x: number;
  y: number;
}

export const SnakeStage = memo(function SnakeStage({
  body,
  food,
  direction,
  status,
  crash,
  pending,
  label,
  onSwipe,
}: SnakeStageProps) {
  const swipeRef = useRef<Track | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // The newest press is the one tracked, as on 2048's board (issue #187):
    // a release can go missing entirely, and a record that outlived the next
    // press would deafen the board. The finger it replaces is ignored from
    // here on — its moves carry another pointer id.
    swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    // Keep hearing this pointer when it leaves the board mid-swipe (a mouse
    // dragged past the edge). jsdom and old engines may not have it.
    const target = event.currentTarget;
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that is already gone cannot be captured; nothing to do.
      }
    }
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const track = swipeRef.current;
      if (track === null || track.id !== event.pointerId) return;
      const dx = event.clientX - track.x;
      const dy = event.clientY - track.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
      // Re-anchor first: whatever the turn does, the next one is measured
      // from here.
      track.x = event.clientX;
      track.y = event.clientY;
      if (Math.abs(dx) >= Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left');
      else onSwipe(dy > 0 ? 'down' : 'up');
    },
    [onSwipe],
  );

  /**
   * The release, or the platform taking the finger away (the notification
   * shade, a call, a palm): either way this pointer's swipe is over. Nothing
   * is entered here — a swipe enters on the move that reaches the threshold
   * — so a cancel has nothing to take back and nothing left to arm
   * (docs/ARCHITECTURE.md「指を取り上げられたときの契約」).
   */
  const endSwipe = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (swipeRef.current?.id === event.pointerId) swipeRef.current = null;
  }, []);

  return (
    <div
      className="sn-stage"
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endSwipe}
      onPointerCancel={endSwipe}
    >
      <SnakeBoard
        body={body}
        food={food}
        direction={direction}
        status={status}
        crash={crash}
        pending={pending}
      />
    </div>
  );
});
