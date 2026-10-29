/**
 * The three Quick Rules pictures (docs/TANGRAM_RULES.md §9): small still
 * drawings made of the board's own parts — the silhouette's film on the page,
 * the pieces in flat wood (no grain: its tile is in pixels and these are drawn
 * in units — tangram.css), an outline where a piece cannot go. No text on
 * them, and hidden from screen readers: the sentence under each carries the
 * meaning.
 */
import {
  figureById,
  PIECE_IDS,
  poseVertices,
  ptToFloat,
  type PieceId,
  type Pose,
} from '../../game';
import { shadeOf } from './TangramBoard';

const SQUARE = figureById('square')!;
const SIDE = 4 * Math.SQRT2;

const points = (vertices: readonly (readonly [number, number])[], dx = 0, dy = 0): string =>
  vertices.map(([x, y]) => `${(x + dx).toFixed(3)},${(y + dy).toFixed(3)}`).join(' ');

const pieceAt = (id: PieceId, pose: Pose, dx = 0, dy = 0): string =>
  points(poseVertices(id, pose).map(ptToFloat), dx, dy);

function Silhouette({ dx = 0 }: { dx?: number }) {
  return <polygon className="tn-silhouette" points={points(SQUARE.outline.map(ptToFloat), dx)} />;
}

/** 1: a triangle carried from the tray onto the shadow, and a tap's clockwise turn. */
function CarryFigure() {
  const tri: [number, number][] = [
    [0.4, 2.2],
    [3.2, 2.2],
    [0.4, 5],
  ];
  return (
    <svg className="tn-figure" viewBox="-0.2 -0.4 12.4 6.4" aria-hidden="true">
      <Silhouette dx={6.3} />
      <g className="tn-figure-piece tn-shade-a">
        <polygon className="tn-shape" points={points(tri)} />
      </g>
      <path className="tn-figure-arrow" d="M 3.6 3.6 L 5.6 3.6" />
      <path className="tn-figure-arrow" d="M 5.1 3.1 L 5.6 3.6 L 5.1 4.1" />
      {/* The turn a tap makes: a quarter arc, clockwise, over the piece. */}
      <path className="tn-figure-arrow" d="M 0.6 1.4 A 1.6 1.6 0 0 1 3 1" />
      <path className="tn-figure-arrow" d="M 2.4 0.7 L 3 1 L 2.7 1.6" />
    </svg>
  );
}

/** 2: a piece placed inside the shadow (filled), one sticking out (outline only). */
function InsideFigure() {
  const { L1, L2 } = SQUARE.solution;
  return (
    <svg className="tn-figure" viewBox={`-0.4 -0.4 ${SIDE + 3.2} ${SIDE + 0.8}`} aria-hidden="true">
      <Silhouette />
      <g className={`tn-figure-piece tn-shade-${shadeOf('L1')}`}>
        <polygon className="tn-shape" points={pieceAt('L1', L1)} />
      </g>
      <polygon className="tn-carry-open" points={pieceAt('L2', L2, 2.4, 0.6)} />
    </svg>
  );
}

/** 3: all seven pieces filling the shadow exactly. */
function DoneFigure() {
  return (
    <svg className="tn-figure" viewBox={`-0.4 -0.4 ${SIDE + 0.8} ${SIDE + 0.8}`} aria-hidden="true">
      <Silhouette />
      {PIECE_IDS.map((id) => (
        <g key={id} className={`tn-figure-piece tn-shade-${shadeOf(id)}`}>
          <polygon className="tn-shape" points={pieceAt(id, SQUARE.solution[id])} />
        </g>
      ))}
    </svg>
  );
}

export function TangramFigure({ step }: { step: number }) {
  if (step === 0) return <CarryFigure />;
  if (step === 1) return <InsideFigure />;
  return <DoneFigure />;
}
