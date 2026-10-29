/**
 * The board as it is drawn (docs/SNAKE_RULES.md §1, §13「見た目」): one inline
 * SVG whose units are cells, so the 14×14 grid scales to whatever box it is
 * given — `preserveAspectRatio` keeps it square and centred, which is how a
 * short screen gets a smaller board instead of a scrolled one.
 *
 * Nothing on it is told apart by colour alone:
 *
 * - the body is rounded squares joined by a narrower neck, so a coil's
 *   neighbouring segments that are NOT consecutive show a gap between them;
 *   each is edged with a thin line of the ink, so the segments read as beads
 *   on a cord rather than as one flat stamp (the edge is the shape's, not a
 *   meaning — nothing is told apart by it);
 * - the head is the larger square with two eyes on the side it moves to;
 * - the food is a circle, the only round thing on the board;
 * - a crashed head wears a × instead of its eyes;
 * - a heading chosen while paused (§5) is an arrow leaving the head, apart
 *   from the eyes, which still face the way the snake last moved.
 *
 * Memoised on exactly what changes the picture — body, food, heading, status,
 * crash, chosen heading — so a turn queued while running, which only changes
 * the session's queue, draws nothing (§13「描画とループ」). Each segment is
 * keyed by its cell: a move adds the new head and drops the tail, and every
 * other segment's element stays where it is. No text is drawn on it (§1).
 *
 * The same component draws the Quick Rules figures (§12), through `view`.
 */
import { memo } from 'react';
import {
  BOARD_SIZE,
  colOf,
  directionBetween,
  rowOf,
  type Crash,
  type Direction,
  type RunStatus,
} from '../../game';

export interface BoardView {
  /** Top-left cell of the window shown. */
  readonly row: number;
  readonly col: number;
  /** Cells across (and down) the window. */
  readonly size: number;
}

export interface SnakeBoardProps {
  /** Cells the snake covers, head first. */
  body: readonly number[];
  /** The food's cell, or -1 once the board is full. */
  food: number;
  /** The way the head faces: last moved, or tried to move when it crashed. */
  direction: Direction;
  status: RunStatus;
  crash: Crash | null;
  /** The heading chosen while paused, drawn as an arrow, or null. */
  pending: Direction | null;
  /** A window onto part of the board (Quick Rules); the whole board when absent. */
  view?: BoardView;
  className?: string;
}

/** How far the wall's stroke reaches past the cells, in cells. */
const WALL = 0.16;

/*
 * The snake's shapes are drawn with an edge (`stroke-width` 0.045 on
 * `.sn-flesh` and `.sn-head-shape` in snake.css; boardLook.test.tsx checks the
 * sizes below against it). A stroke is centred on the outline, so it reaches
 * 0.0225 beyond it: each size is the silhouette the player sees (0.78, 0.92,
 * 0.46 cells) less the edge's 0.045, so the edge sits inside that outline and
 * the gaps between shapes stay as wide as they were — 0.22 between two
 * segments, 0.15 between the head and one that is not its neck (§13「見た目」).
 */
/** A body segment's side, in cells; the rest of the cell is the gap. */
const SEGMENT = 0.735;
/** The head is a little larger, so its shape alone says which end it is. */
const HEAD = 0.875;
/** The neck that joins consecutive segments across the gap. */
const NECK = 0.415;

/*
 * Corner radii, in cells (§13「見た目」). The body stops well short of
 * SEGMENT / 2 = 0.37, where it would be a circle: the food is "the only round
 * thing on the board", and a bead must not be mistaken for it.
 */
const SEGMENT_RX = 0.26;
const HEAD_RX = 0.34;
/**
 * The wall's centre line is rounded to this; with its stroke of WALL its outer
 * edge is WALL_RX + WALL / 2 = 0.36 and its inner edge WALL_RX - WALL / 2 =
 * 0.20. The box round the board (`.sn-stage-wrap`) takes 0.36 / (BOARD_SIZE +
 * WALL) = 2.5% as its radius, so the frame's corner follows the wall's at
 * every size.
 */
const WALL_RX = 0.28;
const FLOOR_RX = 0.2;
/** How wide the shade the wall casts on the floor is, along the top and the left, in cells. */
const DENT = 0.14;

/** The L-shaped band along the floor's top and left edges, under the wall. */
const DENT_PATH = `M0 0H${BOARD_SIZE}V${DENT}H${DENT}V${BOARD_SIZE}H0Z`;

const GRID_PATH = (() => {
  let d = '';
  for (let i = 1; i < BOARD_SIZE; i++) d += `M${i} 0V${BOARD_SIZE}M0 ${i}H${BOARD_SIZE}`;
  return d;
})();

/**
 * The empty board: floor, the shade under the wall's top and left, grid and
 * wall. Never changes, so it renders once per mount. The shade is one static
 * path, so a move still changes only the head, the tail and the neck (§13「描画
 * とループ」). The wall is painted last and covers the shade's square ends.
 */
const Floor = memo(function Floor() {
  return (
    <>
      <rect className="sn-floor" x={0} y={0} width={BOARD_SIZE} height={BOARD_SIZE} rx={FLOOR_RX} />
      <path className="sn-recess" d={DENT_PATH} />
      <path className="sn-grid" d={GRID_PATH} />
      <rect
        className="sn-wall"
        x={-WALL / 2}
        y={-WALL / 2}
        width={BOARD_SIZE + WALL}
        height={BOARD_SIZE + WALL}
        rx={WALL_RX}
        strokeWidth={WALL}
      />
    </>
  );
});

/** The neck from a segment's centre towards the next segment headwards. */
function neckRect(cell: number, toward: Direction) {
  const x = colOf(cell) + 0.5;
  const y = rowOf(cell) + 0.5;
  const half = NECK / 2;
  switch (toward) {
    case 'up':
      return { x: x - half, y: y - 1, width: NECK, height: 1 };
    case 'down':
      return { x: x - half, y, width: NECK, height: 1 };
    case 'left':
      return { x: x - 1, y: y - half, width: 1, height: NECK };
    case 'right':
      return { x, y: y - half, width: 1, height: NECK };
  }
}

interface SegmentProps {
  cell: number;
  /** Where the next segment towards the head is, or null for the head itself. */
  toward: Direction | null;
}

const Segment = memo(function Segment({ cell, toward }: SegmentProps) {
  const inset = (1 - SEGMENT) / 2;
  return (
    <g className="sn-segment">
      {toward === null ? null : <rect className="sn-flesh" {...neckRect(cell, toward)} />}
      <rect
        className="sn-flesh"
        x={colOf(cell) + inset}
        y={rowOf(cell) + inset}
        width={SEGMENT}
        height={SEGMENT}
        rx={SEGMENT_RX}
      />
    </g>
  );
});

/** Where the two eyes sit for a heading: towards the front, one each side. */
function eyes(direction: Direction): readonly [number, number, number, number] {
  switch (direction) {
    case 'up':
      return [0.3, 0.32, 0.7, 0.32];
    case 'down':
      return [0.3, 0.68, 0.7, 0.68];
    case 'left':
      return [0.32, 0.3, 0.32, 0.7];
    case 'right':
      return [0.68, 0.3, 0.68, 0.7];
  }
}

interface HeadProps {
  cell: number;
  direction: Direction;
  crashed: boolean;
}

const Head = memo(function Head({ cell, direction, crashed }: HeadProps) {
  const x = colOf(cell);
  const y = rowOf(cell);
  const inset = (1 - HEAD) / 2;
  const [ax, ay, bx, by] = eyes(direction);
  return (
    <g className="sn-head">
      <rect
        className="sn-head-shape"
        x={x + inset}
        y={y + inset}
        width={HEAD}
        height={HEAD}
        rx={HEAD_RX}
      />
      {crashed ? (
        <path
          className="sn-crash"
          d={`M${x + 0.28} ${y + 0.28}L${x + 0.72} ${y + 0.72}M${x + 0.72} ${y + 0.28}L${x + 0.28} ${y + 0.72}`}
        />
      ) : (
        <>
          <circle className="sn-eye" cx={x + ax} cy={y + ay} r={0.1} />
          <circle className="sn-eye" cx={x + bx} cy={y + by} r={0.1} />
        </>
      )}
    </g>
  );
});

/** The chosen heading (§5): a shaft out of the head and an arrowhead in the next cell. */
function PendingArrow({ cell, direction }: { cell: number; direction: Direction }) {
  const cx = colOf(cell) + 0.5;
  const cy = rowOf(cell) + 0.5;
  const [dx, dy] =
    direction === 'up'
      ? [0, -1]
      : direction === 'down'
        ? [0, 1]
        : direction === 'left'
          ? [-1, 0]
          : [1, 0];
  // Perpendicular, for the arrowhead's two barbs.
  const [px, py] = [-dy, dx];
  const from = 0.5;
  const tip = 1.3;
  const barb = 0.95;
  const spread = 0.28;
  const d =
    `M${cx + dx * from} ${cy + dy * from}L${cx + dx * tip} ${cy + dy * tip}` +
    `M${cx + dx * barb + px * spread} ${cy + dy * barb + py * spread}` +
    `L${cx + dx * tip} ${cy + dy * tip}` +
    `L${cx + dx * barb - px * spread} ${cy + dy * barb - py * spread}`;
  return <path className="sn-pending" d={d} />;
}

export const SnakeBoard = memo(function SnakeBoard({
  body,
  food,
  direction,
  status,
  crash,
  pending,
  view,
  className,
}: SnakeBoardProps) {
  const box = view ?? { row: 0, col: 0, size: BOARD_SIZE };
  const viewBox = `${box.col - WALL} ${box.row - WALL} ${box.size + 2 * WALL} ${box.size + 2 * WALL}`;
  const head = body[0];
  // Tail first, so the head is painted last and nothing covers its face.
  const segments: { cell: number; toward: Direction | null }[] = [];
  for (let i = body.length - 1; i >= 1; i--) {
    segments.push({ cell: body[i]!, toward: directionBetween(body[i]!, body[i - 1]!) });
  }
  return (
    <svg
      className={['sn-svg', className].filter(Boolean).join(' ')}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <Floor />
      {food >= 0 ? (
        <circle className="sn-food" cx={colOf(food) + 0.5} cy={rowOf(food) + 0.5} r={0.32} />
      ) : null}
      {segments.map((segment) => (
        <Segment key={segment.cell} cell={segment.cell} toward={segment.toward} />
      ))}
      {head === undefined ? null : (
        <Head cell={head} direction={direction} crashed={status === 'over' && crash !== null} />
      )}
      {head !== undefined && pending !== null ? (
        <PendingArrow cell={head} direction={pending} />
      ) : null}
    </svg>
  );
});
