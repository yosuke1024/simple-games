/**
 * One gem, drawn as an inline SVG silhouette (docs/GEM_SWAP_RULES.md §10):
 * never a font glyph, so a missing font cannot turn a gem into tofu. The
 * shape carries the kind and the colour only helps — each kind's outline
 * points a different way (up and down, flat, up, sideways, down, notched),
 * and none is one of Bubble Pop's six marks.
 *
 * The fill is the kind's game-content colour token (`--gs-gem-0` … `-5`,
 * gem-swap.css). Three paths, back to front: the shadow the gem casts (its
 * own outline, pushed down in CSS — a same-shape path rather than a filter,
 * §10), the outline, and the facet (a smaller copy of the cut, drawn as a
 * lit face). The component itself writes no colour. Decorative: the cell
 * around it carries the spoken name.
 */
import { memo } from 'react';
import { gemShape, type GemShape } from '../../game';

/** Outline and facet per cut, on a 100 × 100 box. */
const PATHS: Readonly<Record<GemShape, { outline: string; facet: string }>> = {
  // Point up and down.
  hexagon: {
    outline: 'M50 7 L87 28.5 L87 71.5 L50 93 L13 71.5 L13 28.5 Z',
    facet: 'M50 24 L72 37 L72 63 L50 76 L28 63 L28 37 Z',
  },
  // A tall emerald cut: flat top and bottom, corners cut.
  octagon: {
    outline: 'M33 8 L67 8 L81 22 L81 78 L67 92 L33 92 L19 78 L19 22 Z',
    facet: 'M38 22 L62 22 L67 27 L67 73 L62 78 L38 78 L33 73 L33 27 Z',
  },
  // A drop: pointed at the top, round below.
  pear: {
    outline: 'M50 5 C61 24 83 42 83 62 A33 33 0 0 1 17 62 C17 42 39 24 50 5 Z',
    facet: 'M50 30 C56 42 66 52 66 62 A16 16 0 0 1 34 62 C34 52 44 42 50 30 Z',
  },
  // An eye on its side: pointed left and right.
  marquise: {
    outline: 'M4 50 Q50 0 96 50 Q50 100 4 50 Z',
    facet: 'M26 50 Q50 28 74 50 Q50 72 26 50 Z',
  },
  // A shield: flat top, pointed at the bottom.
  shield: {
    outline: 'M14 9 L86 9 L86 54 L50 93 L14 54 Z',
    facet: 'M30 23 L70 23 L70 50 L50 72 L30 50 Z',
  },
  // A heart: the notch at the top. Kind 5 — six-gem boards only (§10).
  heart: {
    outline:
      'M50 92 C22 72 7 55 7 36 A21.5 21.5 0 0 1 50 27 A21.5 21.5 0 0 1 93 36 C93 55 78 72 50 92 Z',
    facet: 'M50 74 C35 63 26 54 26 43 A12 12 0 0 1 50 40 A12 12 0 0 1 74 43 C74 54 65 63 50 74 Z',
  },
};

export interface GemIconProps {
  kind: number;
  className?: string;
}

export const GemIcon = memo(function GemIcon({ kind, className }: GemIconProps) {
  const shape = gemShape(kind);
  if (shape === null) return null;
  const { outline, facet } = PATHS[shape];
  return (
    <svg
      className={`gs-gem gs-gem-${kind}${className ? ` ${className}` : ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <path className="gs-gem-shade" d={outline} />
      <path className="gs-gem-body" d={outline} />
      <path className="gs-gem-facet" d={facet} />
    </svg>
  );
});
