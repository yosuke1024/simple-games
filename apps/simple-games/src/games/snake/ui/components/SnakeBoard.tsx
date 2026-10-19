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
/** A body segment's side, in cells; the rest of the cell is the gap. */
const SEGMENT = 0.78;
/** The head is a little larger, so its shape alone says which end it is. */
const HEAD = 0.92;
/** The neck that joins consecutive segments across the gap. */
const NECK = 0.46;

const GRID_PATH = (() => {
  let d = '';
  for (let i = 1; i < BOARD_SIZE; i++) d += `M${i} 0V${BOARD_SIZE}M0 ${i}H${BOARD_SIZE}`;
  return d;
})();

/** The empty board: floor, grid and wall. Never changes, so it renders once per mount. */
const Floor = memo(function Floor() {
  return (
    <>
      <rect className="sn-floor" x={0} y={0} width={BOARD_SIZE} height={BOARD_SIZE} />
      <path className="sn-grid" d={GRID_PATH} />
      <rect
        className="sn-wall"
        x={-WALL / 2}
        y={-WALL / 2}
        width={BOARD_SIZE + WALL}
        height={BOARD_SIZE + WALL}
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
      {toward === null ? null : <rect className="sn-body" {...neckRect(cell, toward)} />}
      <rect
        className="sn-body"
        x={colOf(cell) + inset}
        y={rowOf(cell) + inset}
        width={SEGMENT}
        height={SEGMENT}
        rx={0.2}
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
        rx={0.28}
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
