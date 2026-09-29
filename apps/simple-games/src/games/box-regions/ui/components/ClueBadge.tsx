/**
 * The clue as one badge (docs/BOX_REGIONS_RULES.md §2, §13): the kind is the
 * badge's own proportion — a wide badge for `wide`, a tall one for `tall`, a
 * square for `square` — and the number, when the clue has one, sits inside
 * it. `free` ("any box") is a wide and a tall outline, dashed, laid over each
 * other with a small solid square where they cross: either orientation, any
 * size, the number in the middle when there is one.
 *
 * Inline SVG rather than a glyph or an emoji: the same in every font, every
 * locale and both themes, and the digits are ASCII inside the drawing
 * (docs/I18N_POLICY.md). The badge is drawn in `currentColor` — the cell's
 * ink, or the warn colour while the box breaks a rule (§5) — and the digits in
 * the paper colour, so the two never have to be tuned per theme. A screen
 * reader gets the kind's translated name and the number from the cell's
 * label, never from this picture (`aria-hidden`).
 *
 * The notation follows the puzzle this game is compared with — a number
 * inside an orientation badge, a dashed pair for "either way" — so a player
 * practising for it reads a clue the same way here (§14). The drawing itself
 * is this game's own: our geometry, our ink, no asset of anyone else's.
 */
import type { ShapeKind } from '../../game';

/** viewBox units; the badge scales with the cell (`.br-clue` in box-regions.css). */
const BOX = 40;

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
}

const WIDE: Frame = { x: 3, y: 11, w: 34, h: 18, rx: 5 };
const TALL: Frame = { x: 11, y: 3, w: 18, h: 34, rx: 5 };
const SQUARE: Frame = { x: 7, y: 7, w: 26, h: 26, rx: 6 };
/** The solid centre of `free`, where the two dashed outlines cross. */
const EITHER: Frame = { x: 10, y: 10, w: 20, h: 20, rx: 5 };

const FRAMES: Record<Exclude<ShapeKind, 'free'>, Frame> = {
  square: SQUARE,
  tall: TALL,
  wide: WIDE,
};

const solid = (frame: Frame) => (
  <rect
    className="br-badge-fill"
    x={frame.x}
    y={frame.y}
    width={frame.w}
    height={frame.h}
    rx={frame.rx}
    fill="currentColor"
  />
);

const dashed = (frame: Frame) => (
  <rect
    className="br-badge-dash"
    x={frame.x}
    y={frame.y}
    width={frame.w}
    height={frame.h}
    rx={frame.rx}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeDasharray="3.2 2.4"
  />
);

export interface ClueBadgeProps {
  readonly kind: ShapeKind;
  /** The clue's number, or null for a kind-only clue (§2). */
  readonly size: number | null;
}

export function ClueBadge({ kind, size }: ClueBadgeProps) {
  const digits = size === null ? '' : String(size);
  // Two digits share the width one digit has; the tall badge is the narrow one.
  const fontSize = digits.length > 1 ? (kind === 'tall' ? 11 : 13) : 16;
  return (
    <svg
      className="br-clue"
      data-kind={kind}
      viewBox={`0 0 ${BOX} ${BOX}`}
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'free' ? (
        <>
          {dashed(WIDE)}
          {dashed(TALL)}
          {solid(EITHER)}
        </>
      ) : (
        solid(FRAMES[kind])
      )}
      {digits !== '' ? (
        <text
          className="br-badge-num"
          x={BOX / 2}
          y={BOX / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
        >
          {digits}
        </text>
      ) : null}
    </svg>
  );
}
