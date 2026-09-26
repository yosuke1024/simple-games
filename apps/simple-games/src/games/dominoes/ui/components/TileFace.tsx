/**
 * A domino's face (docs/DOMINOES_RULES.md §11): two halves, each a 3×3 grid
 * of pips — the same die faces Ludo draws (docs/LUDO_RULES.md §12), with a
 * blank half for zero. Nothing on a face is text, so a tile reads the same in
 * every language. A face never announces itself: whatever holds it — a tile
 * on the line, a button in the hand — carries the label.
 */
import { memo } from 'react';

/** Which of the nine pip positions each value lights, top-left to bottom-right. */
const PIPS: readonly (readonly number[])[] = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

function TileHalf({ value }: { value: number }) {
  const on = PIPS[value] ?? [];
  return (
    <span className="dm-half">
      {Array.from({ length: 9 }, (_, spot) => (
        <span key={spot} className={`dm-pip ${on.includes(spot) ? 'dm-pip-on' : ''}`} />
      ))}
    </span>
  );
}

export interface TileFaceProps {
  /** The first half: the left one lying down, the top one upright. */
  first: number;
  second: number;
  /** Halves stacked rather than side by side (§11). */
  upright?: boolean;
}

export const TileFace = memo(function TileFace({ first, second, upright = false }: TileFaceProps) {
  return (
    <span className={`dm-face ${upright ? 'dm-face-upright' : ''}`} aria-hidden="true">
      <TileHalf value={first} />
      <TileHalf value={second} />
    </span>
  );
});

/** A tile face down: the CPU's hand and the boneyard are counts, never faces (§6). */
export function TileBack({ upright = false }: { upright?: boolean }) {
  return <span className={`dm-back ${upright ? 'dm-back-upright' : ''}`} aria-hidden="true" />;
}

/** "3–5": a tile's pips as text, for labels and the status line. */
export const tileText = (first: number, second: number): string => `${first}–${second}`;
