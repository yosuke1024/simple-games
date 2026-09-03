/**
 * The beat between a board finishing and its result card.
 *
 * A result card that lands on the same frame as the last move hides the one
 * thing the player just made: the filled grid, the sorted tubes, the cleared
 * board. So the card waits — long enough to take the finished board in, short
 * enough that "Next" is still right there — and then arrives (the overlay's
 * rise in ui/styles.css). Nothing else changes: the board is already inert
 * once it is solved, and the facts on the card are the facts either way.
 *
 * Reduced Motion has no arrival to wait for, so the card is there at once,
 * exactly as it always was. That is also what tests see (jsdom has no
 * matchMedia, which useReducedMotion reads as "reduce"), so a test that solves
 * a board still finds the dialog on the next render.
 *
 * The timer is owned by the effect and cancelled with it: leaving the game
 * mid-beat leaves nothing behind (docs/GAME_LIFECYCLE.md).
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export const RESULT_REVEAL_MS = 900;

/**
 * True once `open` has been true for the beat (or at once under Reduced
 * Motion); false the moment `open` is false again.
 */
export function useResultReveal(open: boolean): boolean {
  const reducedMotion = useReducedMotion();
  const [revealed, setRevealed] = useState(() => open && reducedMotion);

  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const id = window.setTimeout(() => setRevealed(true), RESULT_REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [open, reducedMotion]);

  return open && revealed;
}
