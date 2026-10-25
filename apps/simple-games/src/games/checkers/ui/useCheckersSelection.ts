import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Move } from '../game/engine';

/** One control path for both modes, including the piece locked into a jump chain. */
export function useCheckersSelection(
  playing: boolean,
  moves: readonly Move[],
  forcedFrom: number | null,
  play: (move: Move) => boolean,
) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (!playing) setSelected(null);
    else if (forcedFrom !== null) setSelected(forcedFrom);
  }, [playing, forcedFrom]);
  const movable = useMemo(
    () => (playing ? [...new Set(moves.map((move) => move.from))] : []),
    [moves, playing],
  );
  const targets = useMemo(
    () =>
      selected === null
        ? []
        : moves.filter((move) => move.from === selected).map((move) => move.to),
    [moves, selected],
  );
  const onSquare = useCallback(
    (cell: number) => {
      if (!playing) return;
      const move =
        selected === null ? null : moves.find((m) => m.from === selected && m.to === cell);
      if (move) {
        if (play(move)) setSelected(null);
        return;
      }
      if (movable.includes(cell))
        setSelected(cell === selected && forcedFrom === null ? null : cell);
      else if (selected !== null && forcedFrom === null) setSelected(null);
    },
    [forcedFrom, movable, moves, play, playing, selected],
  );
  return { selected, targets, movable, onSquare, clearSelection: () => setSelected(null) };
}
