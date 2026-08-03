/**
 * A timeout for transient UI — toasts, hint marks, flash effects — that is
 * guaranteed not to outlive its component (docs/GAME_LIFECYCLE.md).
 *
 * One instance owns one concern: setting again cancels the pending timer, and
 * unmount cancels whatever is left. Screens that show several independent
 * effects at once (a toast while a hint mark fades) take one instance each, so
 * a new toast can never eat the hint's timer.
 *
 * This replaces bare `window.setTimeout` calls whose handle nobody kept: those
 * fired after the game was closed and called setState on an unmounted tree.
 * Harmless-looking, but "the game is gone, its work is gone" is the contract —
 * src/test/lifecycle.test.tsx fails on any timer that survives unmount.
 */
import { useCallback, useEffect, useRef } from 'react';

export function useTransientTimeout(): (fn: () => void, ms: number) => void {
  const idRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (idRef.current !== null) window.clearTimeout(idRef.current);
    },
    [],
  );

  return useCallback((fn: () => void, ms: number) => {
    if (idRef.current !== null) window.clearTimeout(idRef.current);
    idRef.current = window.setTimeout(() => {
      idRef.current = null;
      fn();
    }, ms);
  }, []);
}
