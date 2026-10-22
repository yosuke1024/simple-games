/* The keyboard half of the shell's two dialogs, ConfirmDialog and the ↻'s
   RestartDialog, and of the Club's RemoveDialog (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」): Escape
   answers exactly as Cancel does, and closing hands the focus back to the
   control that opened the dialog — the ↻ in a game's top bar, a row in
   Settings — so a keyboard or screen-reader user keeps their place instead of
   starting again from the top of the page.

   Call it from a component that exists only while the dialog is open. The
   opener is read on that component's first render, because by the time any
   effect runs, Cancel's autoFocus has already moved the focus into the dialog.
   A press that does not focus the button
   it presses — a click or a tap in WebKit (Safari, every iOS browser) —
   leaves no opener, and then nothing here hands the focus back; a game that
   wants it on the ↻ even then places it itself (the web-beta Snake does).

   - Escape is taken on the window in the capture phase, before the document
     or anything in it sees it, and goes no further: a `useGameKeys` listener
     left attached behind a `blocked` guard (2048's shape) or an arcade
     board's raw keydown listener never also answers the key that closed the
     dialog — nor does a game's own Escape (the web-beta Bridges, Unblock
     Puzzle and Peg Solitaire clear a selection with one; no released game
     binds one).
   - The focus goes back only when it would otherwise be lost (on the body, or
     on a node the dialog took away with it). If whatever ran on close put it
     somewhere on purpose, it stays there; an opener that has left the page (a
     confirm that navigated away, a sheet that re-rendered) is skipped. This
     runs in the card's passive cleanup, so "on purpose" means before it: an
     autoFocus, or a layout effect (Peg Solitaire's and Snake's new board).
   - The listener is released when the dialog closes or unmounts
     (docs/GAME_LIFECYCLE.md). */

import { useEffect, useRef, useState } from 'react';

export function useDialogDismiss(onCancel: () => void): void {
  const [opener] = useState(() => {
    const active = document.activeElement;
    return active instanceof HTMLElement && active !== document.body ? active : null;
  });
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  useEffect(
    () => () => {
      const active = document.activeElement;
      const lost = active === null || active === document.body || !active.isConnected;
      if (lost && opener?.isConnected) opener.focus();
    },
    [opener],
  );
}
