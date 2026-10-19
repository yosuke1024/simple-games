/**
 * The lines of a Bridges board, drawn in one SVG whose user unit is one cell
 * (docs/BRIDGES_RULES.md §5): a cell's centre is at (column + ½, row + ½).
 * Shared by the live board and the Quick Rules figures, so a figure is drawn
 * exactly the way the board it teaches is.
 *
 * Every line runs centre to centre. The island discs sit above the SVG and
 * cover the ends, so a bridge reads as leaving the island's edge.
 */
import { colOf, rowOf } from '../../game';

/** Half the gap between the two lines of a double bridge, in cells. */
const DOUBLE_OFFSET = 0.11;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const centerOf = (index: number, width: number): Point => ({
  x: colOf(index, width) + 0.5,
  y: rowOf(index, width) + 0.5,
});

/** One or two parallel lines between two cell centres on one row or column (§5). */
export function BridgeLines({
  from,
  to,
  count,
  className = 'bg-bridge',
}: {
  from: Point;
  to: Point;
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  if (count === 1) {
    return <line className={className} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
  }
  const horizontal = from.y === to.y;
  const dx = horizontal ? 0 : DOUBLE_OFFSET;
  const dy = horizontal ? DOUBLE_OFFSET : 0;
  return (
    <g className="bg-bridge-double">
      <line className={className} x1={from.x - dx} y1={from.y - dy} x2={to.x - dx} y2={to.y - dy} />
      <line className={className} x1={from.x + dx} y1={from.y + dy} x2={to.x + dx} y2={to.y + dy} />
    </g>
  );
}

/** A faint dot on every water cell: the rows and columns a bridge can run along. */
export function WaterDots({
  width,
  height,
  occupied,
}: {
  width: number;
  height: number;
  occupied: ReadonlySet<number>;
}) {
  const dots = [];
  for (let index = 0; index < width * height; index++) {
    if (occupied.has(index)) continue;
    const { x, y } = centerOf(index, width);
    dots.push(<circle key={index} className="bg-dot" cx={x} cy={y} r={0.045} />);
  }
  return <g>{dots}</g>;
}
