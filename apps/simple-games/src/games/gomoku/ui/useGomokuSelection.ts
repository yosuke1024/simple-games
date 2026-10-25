import { useCallback, useEffect, useState } from 'react';

/** Shared by CPU and nearby play: aiming is local UI, never a game command. */
export function useGomokuSelection(playing: boolean, place: (cell: number) => boolean) {
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (!playing) setPending(null);
  }, [playing]);
  const onPoint = useCallback(
    (cell: number) => {
      if (!playing) return;
      if (pending !== cell) {
        setPending(cell);
        return;
      }
      if (place(cell)) setPending(null);
    },
    [pending, place, playing],
  );
  return { pending, onPoint, clearSelection: () => setPending(null) };
}
