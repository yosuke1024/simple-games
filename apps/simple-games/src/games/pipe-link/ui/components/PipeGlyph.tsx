/**
 * One tile's drawing (docs/PIPE_LINK_RULES.md §1, §10) — the board's tiles,
 * the hint's faint figure and the Quick Rules figures all draw with this, so
 * a figure is the game, smaller.
 *
 * Inline SVG, one unit square of 100. The pipes are drawn at orientation 0
 * and the whole drawing is turned by CSS, so a turn can be animated as the
 * turn it is (§10: the angle is kept cumulative by the board). The tile
 * carries no words: a pipe is a shape, and lit versus unlit is a shape too —
 * an empty groove (a dark outline round a core sunk below the tile's ground)
 * against a full tube (the accent in the core, inside a faint wall of the
 * same colour) — never colour alone.
 *
 * Each shape is drawn first with a thick stroke in the edge colour, then
 * with no stroke in the core colour (laid down twice — see the render below).
 * Overlapping shapes so merge into one tube with one outline. The arms run
 * past the square, so the outline across a pipe's mouth falls outside the
 * tile and two tiles' pipes meet as one. The colours are set on the groups
 * (ui/pipe-link.css) and the shapes inherit them, which is what lets the
 * light come on as one short transition per group (§10).
 */
import { orientationMasks, type TileType } from '../../game';

/** The arm towards each side, clockwise from up (game/tiles.ts). */
const ARMS: readonly { x: number; y: number; width: number; height: number }[] = [
  { x: 38, y: -12, width: 24, height: 62 },
  { x: 50, y: 38, width: 62, height: 24 },
  { x: 38, y: 50, width: 24, height: 62 },
  { x: -12, y: 38, width: 62, height: 24 },
];

function Shapes({ type, mask }: { type: TileType; mask: number }) {
  return (
    <>
      {ARMS.map((arm, dir) => ((mask & (1 << dir)) !== 0 ? <rect key={dir} {...arm} /> : null))}
      {/* The joint, and an end's cap: an end is the one tile that stops. */}
      <circle cx={50} cy={50} r={type === 'end' ? 21 : 12} />
    </>
  );
}

export interface PipeGlyphProps {
  type: TileType;
  /** Orientation 0 is drawn; the caller turns the drawing (`turns` × 90°). */
  turns: number;
  lit: boolean;
  className?: string;
}

/** The pipes of one tile, turned `turns` quarter turns clockwise. */
export function PipeGlyph({ type, turns, lit, className }: PipeGlyphProps) {
  const mask = orientationMasks(type)[0]!;
  return (
    <svg
      className={`pn-pipes ${lit ? 'pn-pipes-lit' : ''} ${className ?? ''}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${turns * 90}deg)` }}
    >
      <g className="pn-pipe-edge">
        <Shapes type={type} mask={mask} />
      </g>
      {/* The core twice, on purpose (§10, the seam between tiles). Where a
          tile boundary falls inside a device pixel (a fractional cell, which
          is what a browser without round() lays out), both neighbours cover
          that pixel only partly, so the ground and the edge's fill show
          through the core's anti-aliased rim as a hairline across the pipe. A
          second identical coat of the core shuts most of it: same paint, same
          pixels, no new shape, colour or layout. The lit pipe needs it more
          since its edge became a 0.4 wall, which no longer underlays the core
          as an opaque amber did. Decoration only — the svg is aria-hidden. */}
      <g className="pn-pipe-core">
        <Shapes type={type} mask={mask} />
      </g>
      <g className="pn-pipe-core">
        <Shapes type={type} mask={mask} />
      </g>
    </svg>
  );
}

/**
 * The hint's faint figure (§6, §10): the pipes as they should turn, drawn
 * still over the tile in a dashed outline.
 */
export function PipeGhost({ type, orientation }: { type: TileType; orientation: number }) {
  const mask = orientationMasks(type)[orientation] ?? 0;
  return (
    <svg className="pn-ghost" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <Shapes type={type} mask={mask} />
    </svg>
  );
}

/**
 * The source's mark (§1, §10): a filled dot inside a ring, over the joint —
 * a shape, so the source is found without colour. It does not turn with the
 * pipes (it is round), so it sits in its own layer.
 */
export function SourceMark() {
  return (
    <svg className="pn-source" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle className="pn-source-ring" cx={50} cy={50} r={31} />
      <circle className="pn-source-dot" cx={50} cy={50} r={10} />
    </svg>
  );
}
