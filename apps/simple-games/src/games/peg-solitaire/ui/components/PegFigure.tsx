/**
 * A small, still picture of holes and pegs for Quick Rules
 * (docs/PEG_SOLITAIRE_RULES.md §12), drawn with the board's own parts
 * (BoardParts.tsx) so the figure looks like the board it explains. It is a
 * picture, not a control: aria-hidden as a whole, because the step's sentence
 * says what it shows.
 *
 * Coordinates are in pitches, like ui/layout.ts. Arrows are inline SVG in the
 * same units — the figure carries no text of any kind.
 */
import type { CSSProperties } from 'react';
import type { Point } from '../layout';
import { HoleFace, holeStyle, Plate, type PlateShape } from './BoardParts';

export interface FigureHole extends Point {
  readonly peg?: boolean;
  readonly ring?: boolean;
  readonly dot?: boolean;
}

export interface FigureArrow {
  readonly from: Point;
  readonly to: Point;
  /** A control point: the arrow bends through it (a jump arcing over a peg). */
  readonly via?: Point;
}

export interface PegFigureProps {
  /** Size in pitches. */
  width: number;
  height: number;
  holes: readonly FigureHole[];
  plates: readonly PlateShape[];
  arrows?: readonly FigureArrow[];
  /** One pitch on screen, in px. */
  pitch: number;
}

export function PegFigure({ width, height, holes, plates, arrows = [], pitch }: PegFigureProps) {
  const size = { width, height };
  return (
    <div
      className="pg-figure"
      style={{ width: width * pitch, height: height * pitch } as CSSProperties}
      aria-hidden="true"
    >
      <Plate layout={size} shapes={plates} />
      {holes.map((hole, index) => (
        <span key={index} className="pg-hole pg-figure-hole" style={holeStyle(size, hole)}>
          <HoleFace peg={hole.peg === true} ring={hole.ring === true} dot={hole.dot === true} />
        </span>
      ))}
      {arrows.length > 0 ? (
        <svg
          className="pg-figure-arrows"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          focusable="false"
        >
          {arrows.map((arrow, index) => (
            <FigureArrowPath key={index} arrow={arrow} />
          ))}
        </svg>
      ) : null}
    </div>
  );
}

/** A line (or a bend) with a two-stroke head at `to`, in pitch units. */
function FigureArrowPath({ arrow }: { arrow: FigureArrow }) {
  const { from, to, via } = arrow;
  const d = via
    ? `M ${from.x} ${from.y} Q ${via.x} ${via.y} ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  // The head points along the last stretch of the path.
  const tail = via ?? from;
  const angle = Math.atan2(to.y - tail.y, to.x - tail.x);
  const head = 0.22;
  const spread = Math.PI / 7;
  const left = {
    x: to.x - head * Math.cos(angle - spread),
    y: to.y - head * Math.sin(angle - spread),
  };
  const right = {
    x: to.x - head * Math.cos(angle + spread),
    y: to.y - head * Math.sin(angle + spread),
  };
  return (
    <g className="pg-figure-arrow">
      <path d={d} />
      <path d={`M ${left.x} ${left.y} L ${to.x} ${to.y} L ${right.x} ${right.y}`} />
    </g>
  );
}
