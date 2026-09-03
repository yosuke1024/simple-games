import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../useReducedMotion';

const COUNT_MS = 400;

/**
 * A number that counts to its new value instead of jumping — the score's small
 * reward moment. Renders the plain value under reduced motion, and always
 * lands exactly on the real value.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    // Reduced motion, or no frames coming (hidden webview): show it now.
    // rAF self-heals on the next painted frame, but "eventually right" is not
    // good enough for a score.
    if (
      reducedMotion ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    ) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      // Ease-out: fast start, settles gently on the final value.
      const eased = 1 - (1 - k) ** 3;
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);

  return <>{shown}</>;
}
