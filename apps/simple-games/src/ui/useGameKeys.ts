/* Keyboard input as an adapter (issue #93): a key calls the same handler the
   matching tap calls, so nothing is reachable by keyboard that is not on the
   screen — and nothing on the screen needs the keyboard.

   The shell owns only this thin registration seam; which keys mean what stays
   inside each game, next to the tap handlers they mirror. The contract:

   - The handler returns true for a key it acted on (or deliberately
     swallowed); only then is the browser's default suppressed. Everything
     else — scrolling, shortcuts, focus keys — passes through untouched.
   - `enabled: false` detaches the listener entirely. A game passes the same
     condition that inerts its board (result overlay up, confirm dialog open),
     so a modal never plays the game behind itself.
   - Keys typed into a real input (input / textarea / select /
     contenteditable) are never offered to the handler.
   - Key-repeat policy belongs to the game: turn-based games ignore
     `event.repeat` for state-changing keys; held-key movement may accept it.

   Listeners attach to `window` and detach on unmount or disable —
   docs/GAME_LIFECYCLE.md applies to keyboards like any other resource. */

import { useEffect, useRef } from 'react';

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/* Ctrl+Z / Cmd+Z, and nothing that shadows redo or system chords: Shift or
   Alt present means it is not the undo this app answers to. */
export function isUndoKey(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.key === 'z' || event.key === 'Z')
  );
}

export function useGameKeys(
  handler: (event: KeyboardEvent) => boolean,
  enabled: boolean = true,
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      // Another layer (an earlier listener, a game's own canvas handler)
      // already answered this key — do not answer it twice.
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      if (handlerRef.current(event)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
