import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/** A short presentation of an already committed move. Never delays persistence. */
export function useMovePlayback<T>(active: boolean) {
  const reducedMotion = useReducedMotion();
  const [playback, setPlayback] = useState<(T & { durationMs: number }) | null>(null);
  const busy = useRef(false);
  const finish = useCallback(() => {
    busy.current = false;
    setPlayback(null);
  }, []);
  const start = useCallback(
    (value: T, durationMs: number) => {
      if (!active || reducedMotion) return;
      busy.current = true;
      setPlayback({ ...value, durationMs });
    },
    [active, reducedMotion],
  );
  useEffect(() => {
    if (!playback) return;
    if (!active || reducedMotion) {
      finish();
      return;
    }
    // Owned by this playback: hide, dialog, exit and unmount cancel the timer.
    const timer = window.setTimeout(finish, playback.durationMs);
    return () => window.clearTimeout(timer);
  }, [active, reducedMotion, playback, finish]);
  return { playback: active && !reducedMotion ? playback : null, busy, start, finish };
}
