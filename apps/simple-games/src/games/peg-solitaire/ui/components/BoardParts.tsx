/**
 * The pieces every picture of a Peg Solitaire board is drawn from — the
 * playing board, the Quick Rules figures and nothing else
 * (docs/PEG_SOLITAIRE_RULES.md §5, §12, §13). One drawing, so a figure in
 * Quick Rules looks exactly like the board it explains.
 *
 * A hole is one pitch square, in layers that each fill it:
 * - the ring (the target hole only): a circle near the hole's edge — a shape,
 *   not a colour, and visible with a peg in it;
 * - the pit: the hole itself, rimmed so an empty hole reads on its own;
 * - the dot (a hole the selected peg can land in): a mark inside the pit;
 * - the peg: the accent disc.
 * Every layer is aria-hidden: what a hole holds is said by its label.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { BoardLayout, Point } from '../layout';

/** Places a one-pitch square centred on `center`, in percentages of the board. */
export function holeStyle(
  layout: Pick<BoardLayout, 'width' | 'height'>,
  center: Point,
): CSSProperties {
  return {
    left: `${((center.x - 0.5) / layout.width) * 100}%`,
    top: `${((center.y - 0.5) / layout.height) * 100}%`,
    width: `${100 / layout.width}%`,
    height: `${100 / layout.height}%`,
  };
}

export interface PlateShape {
  readonly points: readonly Point[];
  /** A closed outline is filled as well (a whole board); an open one is a bar. */
  readonly closed: boolean;
}

/**
 * The board's plate: a stroke one pitch wide, with round joins, along the
 * outermost hole centres — which covers every hole exactly and gives the
 * board its own shape (a rounded cross, a rounded triangle, a bar of three).
 * Drawn twice, the wider stroke underneath being the plate's edge.
 */
export function Plate({
  layout,
  shapes,
}: {
  layout: Pick<BoardLayout, 'width' | 'height'>;
  shapes: readonly PlateShape[];
}) {
  const draw = (className: string) =>
    shapes.map((shape, index) => {
      const points = shape.points.map((p) => `${p.x},${p.y}`).join(' ');
      return shape.closed ? (
        <polygon key={`${className}-${index}`} className={className} points={points} />
      ) : (
        <polyline key={`${className}-${index}`} className={className} points={points} />
      );
    });
  return (
    <svg
      className="pg-plate"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {draw('pg-plate-edge')}
      {draw('pg-plate-face')}
    </svg>
  );
}

export interface HoleFaceProps {
  peg: boolean;
  ring: boolean;
  dot: boolean;
  /** Extra classes on the peg layer (arriving, lifted). */
  pegClassName?: string;
  pegStyle?: CSSProperties;
  /** A changing key restarts the peg's arrival animation. */
  pegKey?: string;
  /** Layers drawn above the peg (the jumped peg fading out). */
  children?: ReactNode;
}

export function HoleFace({
  peg,
  ring,
  dot,
  pegClassName,
  pegStyle,
  pegKey,
  children,
}: HoleFaceProps) {
  return (
    <>
      {ring ? <span className="pg-layer pg-ring" aria-hidden="true" /> : null}
      <span className="pg-layer pg-pit" aria-hidden="true" />
      {dot ? <span className="pg-layer pg-dot" aria-hidden="true" /> : null}
      {peg ? (
        <span
          key={pegKey ?? 'peg'}
          className={`pg-layer pg-peg${pegClassName ? ` ${pegClassName}` : ''}`}
          style={pegStyle}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </>
  );
}
