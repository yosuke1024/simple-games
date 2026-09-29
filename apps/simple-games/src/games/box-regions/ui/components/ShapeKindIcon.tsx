/**
 * The four kind symbols of docs/BOX_REGIONS_RULES.md §2, drawn as outlines in
 * the current ink. Inline SVG rather than a glyph or an emoji (§13): the same
 * in every font, every locale and both themes, and a screen reader gets the
 * kind's translated name from the cell's label instead of a picture.
 *
 * square is a square outline, tall a taller-than-wide one, wide a
 * wider-than-tall one; free — "any box" — keeps only the top-left and
 * bottom-right corners, the two a stroke is drawn between (§4). Drawn for
 * this game; nothing here is taken from another product's symbols (§14).
 */
import type { ShapeKind } from '../../game';

const STROKE = 1.8;

const OUTLINES: Record<
  Exclude<ShapeKind, 'free'>,
  { x: number; y: number; w: number; h: number }
> = {
  square: { x: 3, y: 3, w: 10, h: 10 },
  tall: { x: 4.5, y: 1.5, w: 7, h: 13 },
  wide: { x: 1.5, y: 4.5, w: 13, h: 7 },
};

export interface ShapeKindIconProps {
  readonly kind: ShapeKind;
}

export function ShapeKindIcon({ kind }: ShapeKindIconProps) {
  return (
    <svg
      className="br-icon"
      data-kind={kind}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === 'free' ? (
        <>
          <path d="M2 7V2h5" />
          <path d="M9 14h5V9" />
        </>
      ) : (
        <rect
          x={OUTLINES[kind].x}
          y={OUTLINES[kind].y}
          width={OUTLINES[kind].w}
          height={OUTLINES[kind].h}
          rx={1.2}
        />
      )}
    </svg>
  );
}
