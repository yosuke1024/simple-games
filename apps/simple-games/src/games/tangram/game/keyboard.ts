/**
 * The keyboard's carried piece (docs/TANGRAM_RULES.md §4「キーボード」).
 *
 * While a piece is lifted its position is a provisional point — the average
 * of its vertices, a float — that the arrows move by exactly one unit. The
 * snapped pose is only drawn; the provisional point is never pulled to it,
 * so the next arrow always starts from where the arrows put it. (Counted
 * from the snapped pose, a step and a reach of one unit each could leave the
 * current pose the nearest candidate for ever.)
 */
import { orientedShape, type Orientation, type PieceId, type Pose } from './pieces';
import { snapPose, type BoardPieces, type SnapOutcome } from './snap';
import { ptToFloat, type Pt } from './z2';

/** One arrow press moves the provisional point this many units (§4 の表). */
export const KEYBOARD_STEP = 1;
/** How far a lifted piece reaches for a snap, the bound included (§4 の表). */
export const KEYBOARD_TOLERANCE = 1;

export type FloatPoint = readonly [x: number, y: number];

/** The average of a piece's oriented local vertices (before the shift by `at`). */
export function centroidOffset(id: PieceId, o: Orientation): FloatPoint {
  const shape = orientedShape(id, o).map(ptToFloat);
  const x = shape.reduce((sum, v) => sum + v[0], 0) / shape.length;
  const y = shape.reduce((sum, v) => sum + v[1], 0) / shape.length;
  return [x, y];
}

/** The provisional point of a piece standing at `pose`. */
export function centroidOf(id: PieceId, pose: Pose): FloatPoint {
  const [ox, oy] = centroidOffset(id, pose);
  const [ax, ay] = ptToFloat(pose.at);
  return [ax + ox, ay + oy];
}

/** The `at` wish that puts a piece's vertex average on `point`. */
export function atForCentroid(id: PieceId, o: Orientation, point: FloatPoint): FloatPoint {
  const [ox, oy] = centroidOffset(id, o);
  return [point[0] - ox, point[1] - oy];
}

/** Where a piece lifted from the tray starts: the silhouette's bounding-box centre (§4). */
export function outlineCenter(outline: readonly Pt[]): FloatPoint {
  const points = outline.map(ptToFloat);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** The provisional point after one arrow press in direction (dx, dy) ∈ {−1, 0, 1}². */
export const stepPoint = (point: FloatPoint, dx: number, dy: number): FloatPoint => [
  point[0] + dx * KEYBOARD_STEP,
  point[1] + dy * KEYBOARD_STEP,
];

/** What a lifted piece at `point` would snap to: the pose drawn, and Enter's drop. */
export function keyboardSnap(
  outline: readonly Pt[],
  board: BoardPieces,
  id: PieceId,
  o: Orientation,
  point: FloatPoint,
): SnapOutcome {
  return snapPose(outline, board, {
    id,
    orientation: o,
    at: atForCentroid(id, o, point),
    tolerance: KEYBOARD_TOLERANCE,
  });
}
