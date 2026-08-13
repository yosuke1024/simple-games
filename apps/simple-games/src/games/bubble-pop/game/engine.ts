/**
 * The shared shot simulation (docs/BUBBLE_POP_RULES.md §8 — the collection's
 * carveout for this game). `simulateShot` is the one function that decides
 * where a bubble lands: the aim guide and the real shot both call it with the
 * exact same `board` reference and `ceilingOffset`, so a preview can never
 * show a landing cell the real shot would miss. Nothing in this file gives a
 * caller a way to hand the guide a cached or stale board — there is no
 * "prepare a guide" entry point that snapshots state, only this pure
 * function of its explicit arguments, called fresh every time (session.ts is
 * the one place that calls it, from the one board it holds).
 *
 * `simulateShot` also stops at the landing cell — it deliberately does not
 * compute or return whether that landing pops anything. Reading the board
 * well enough to know that is the point of the game (§8): the guide may
 * never be a strictly better version of playing.
 */
import {
  AIM_MAX_ANGLE_FROM_VERTICAL,
  BOARD_WIDTH,
  CELL_DIAMETER,
  CELL_RADIUS,
  LAUNCHER_X,
  LAUNCHER_Y,
  LOSS_LINE_Y,
  MAX_TRAJECTORY_STEPS,
  POP_MIN_CLUSTER,
  ROW_HEIGHT,
  SHOT_SPEED,
  SHOT_STEP_MS,
} from './constants';
import {
  allCellsInRow,
  cellCenter,
  cellFromKey,
  cellKey,
  distance,
  effectiveCenter,
  neighborsOf,
} from './grid';
import type { Board, BubbleColor, Cell, Point, ResolveOutcome, ShotResult } from './types';

/** Vertical-from-center clamp (constants.ts explains the 70° choice). */
export function clampAimAngle(angle: number): number {
  return Math.min(AIM_MAX_ANGLE_FROM_VERTICAL, Math.max(-AIM_MAX_ANGLE_FROM_VERTICAL, angle));
}

function pickNearest(candidates: readonly Cell[], near: Point, ceilingOffset: number): Cell {
  let best = candidates[0]!;
  let bestDistance = distance(effectiveCenter(best, ceilingOffset), near);
  for (let i = 1; i < candidates.length; i++) {
    const cell = candidates[i]!;
    const d = distance(effectiveCenter(cell, ceilingOffset), near);
    // Ties (a shot landing equidistant between two open cells) resolve to
    // the upper, then the leftmost, cell — a fixed rule so the same input
    // always snaps the same way (docs/BUBBLE_POP_RULES.md §1).
    if (d < bestDistance - 1e-9) {
      best = cell;
      bestDistance = d;
    } else if (Math.abs(d - bestDistance) <= 1e-9) {
      if (cell.row < best.row || (cell.row === best.row && cell.col < best.col)) {
        best = cell;
        bestDistance = d;
      }
    }
  }
  return best;
}

/**
 * Nearest empty cell reachable from `start` by grid steps, breaking ties on
 * pixel distance to the impact point (§1). BFS outward ring by ring so an
 * ordinary shot resolves in its immediate neighborhood, and a shot that
 * lands against a fully packed pocket still resolves instead of throwing —
 * POP_MIN_CLUSTER guarantees popping always reopens room, but this keeps the
 * function total for the synthetic boards the test suite builds.
 */
function nearestEmptyCell(board: Board, start: Cell, near: Point, ceilingOffset: number): Cell {
  if (!board.has(cellKey(start))) return start;
  const visited = new Set<string>([cellKey(start)]);
  let frontier: Cell[] = [start];
  while (frontier.length > 0) {
    const nextFrontier: Cell[] = [];
    const emptyInLayer: Cell[] = [];
    for (const cell of frontier) {
      for (const neighbor of neighborsOf(cell)) {
        const key = cellKey(neighbor);
        if (visited.has(key)) continue;
        visited.add(key);
        if (board.has(key)) nextFrontier.push(neighbor);
        else emptyInLayer.push(neighbor);
      }
    }
    if (emptyInLayer.length > 0) return pickNearest(emptyInLayer, near, ceilingOffset);
    frontier = nextFrontier;
  }
  return start; // Board has no empty cell reachable at all — cannot happen in play.
}

function nearestCellInRow(row: number, x: number): Cell {
  const candidates = allCellsInRow(row);
  let best = candidates[0]!;
  let bestGap = Math.abs(cellCenter(best).x - x);
  for (let i = 1; i < candidates.length; i++) {
    const cell = candidates[i]!;
    const gap = Math.abs(cellCenter(cell).x - x);
    if (gap < bestGap) {
      best = cell;
      bestGap = gap;
    }
  }
  return best;
}

interface OccupiedPoint {
  readonly cell: Cell;
  readonly x: number;
  readonly y: number;
}

/**
 * `simulateShot` precomputes this once per call (board and ceilingOffset are
 * fixed for the whole flight) so the hot per-step loop below never re-derives
 * a cell's on-screen position or re-parses a map key hundreds of times over.
 */
function occupiedPoints(board: Board, ceilingOffset: number): OccupiedPoint[] {
  const points: OccupiedPoint[] = [];
  for (const key of board.keys()) {
    const cell = cellFromKey(key);
    const { x, y } = effectiveCenter(cell, ceilingOffset);
    points.push({ cell, x, y });
  }
  return points;
}

function nearestOccupiedCollision(points: readonly OccupiedPoint[], at: Point): Cell | null {
  let best: OccupiedPoint | null = null;
  let bestDistance = Infinity;
  for (const point of points) {
    const d = Math.hypot(point.x - at.x, point.y - at.y);
    if (d > CELL_DIAMETER) continue;
    if (
      d < bestDistance - 1e-9 ||
      (Math.abs(d - bestDistance) <= 1e-9 &&
        best !== null &&
        (point.cell.row < best.cell.row ||
          (point.cell.row === best.cell.row && point.cell.col < best.cell.col)))
    ) {
      best = point;
      bestDistance = d;
    }
  }
  return best ? best.cell : null;
}

/**
 * The one shot simulation. Bounces off the side walls without limit
 * (constants.ts documents why that is provably bounded, not just assumed) and
 * stops the instant it reaches the ceiling line or an existing bubble.
 */
export function simulateShot(board: Board, ceilingOffset: number, angle: number): ShotResult {
  const clamped = clampAimAngle(angle);
  let x = LAUNCHER_X;
  let y = LAUNCHER_Y;
  let vx = SHOT_SPEED * Math.sin(clamped);
  const vy = -SHOT_SPEED * Math.cos(clamped);
  const dt = SHOT_STEP_MS / 1000;
  const path: Point[] = [{ x, y }];
  const ceilingY = ceilingOffset * ROW_HEIGHT;
  const points = occupiedPoints(board, ceilingOffset);

  for (let step = 0; step < MAX_TRAJECTORY_STEPS; step++) {
    x += vx * dt;
    y += vy * dt;

    if (x - CELL_RADIUS < 0) {
      x = 2 * CELL_RADIUS - x;
      vx = Math.abs(vx);
      path.push({ x, y });
    } else if (x + CELL_RADIUS > BOARD_WIDTH) {
      x = 2 * (BOARD_WIDTH - CELL_RADIUS) - x;
      vx = -Math.abs(vx);
      path.push({ x, y });
    }

    if (y - CELL_RADIUS <= ceilingY) {
      y = ceilingY + CELL_RADIUS;
      path.push({ x, y });
      const start = nearestCellInRow(0, x);
      return { path, landingCell: nearestEmptyCell(board, start, { x, y }, ceilingOffset) };
    }

    const hit = nearestOccupiedCollision(points, { x, y });
    if (hit) {
      path.push({ x, y });
      return { path, landingCell: nearestEmptyCell(board, hit, { x, y }, ceilingOffset) };
    }
  }

  // Defensive fallback — see MAX_TRAJECTORY_STEPS. Land at the ceiling above
  // wherever the budget ran out so a regression here reads as "wrong cell",
  // never as a hang.
  const start = nearestCellInRow(0, x);
  return { path, landingCell: nearestEmptyCell(board, start, { x, y }, ceilingOffset) };
}

/** BFS over cells matching `predicate`, starting from `start` (inclusive). */
export function connectedGroup(
  board: Board,
  start: Cell,
  predicate: (color: BubbleColor) => boolean,
): Cell[] {
  const startColor = board.get(cellKey(start));
  if (startColor === undefined || !predicate(startColor)) return [];
  const visited = new Set<string>([cellKey(start)]);
  const result: Cell[] = [start];
  const stack: Cell[] = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const neighbor of neighborsOf(current)) {
      const key = cellKey(neighbor);
      if (visited.has(key)) continue;
      const color = board.get(key);
      if (color === undefined || !predicate(color)) continue;
      visited.add(key);
      result.push(neighbor);
      stack.push(neighbor);
    }
  }
  return result;
}

/** Every cell reachable from row 0 through occupied neighbors — the ceiling's grip. */
export function ceilingAttachedCells(board: Board): Set<string> {
  const attached = new Set<string>();
  for (const cell of allCellsInRow(0)) {
    const key = cellKey(cell);
    if (board.has(key) && !attached.has(key)) {
      for (const linked of connectedGroup(board, cell, () => true)) attached.add(cellKey(linked));
    }
  }
  return attached;
}

/**
 * One move's full resolution (§2): place, pop a same-color group of
 * POP_MIN_CLUSTER or more, then drop whatever the pop left disconnected from
 * the ceiling. Pure — the caller (session.ts) decides what the counts mean
 * for shots-until-descent and win/loss.
 */
export function placeAndResolve(board: Board, cell: Cell, color: BubbleColor): ResolveOutcome {
  const placed = new Map(board);
  placed.set(cellKey(cell), color);

  const group = connectedGroup(placed, cell, (c) => c === color);
  const popped = group.length >= POP_MIN_CLUSTER ? group : [];
  const afterPop = new Map(placed);
  for (const g of popped) afterPop.delete(cellKey(g));

  const attached = ceilingAttachedCells(afterPop);
  const fell: Cell[] = [];
  const afterDrop = new Map(afterPop);
  for (const key of afterPop.keys()) {
    if (!attached.has(key)) {
      afterDrop.delete(key);
      fell.push(cellFromKey(key));
    }
  }

  return { board: afterDrop, popped, fell };
}

/** The ceiling drops exactly one row's worth per descent event (§3). */
export function nextCeilingOffset(ceilingOffset: number): number {
  return ceilingOffset + 1;
}

/** True once any bubble's lower edge has reached the loss line (§3). */
export function crossesLossLine(board: Board, ceilingOffset: number): boolean {
  for (const key of board.keys()) {
    const { y } = effectiveCenter(cellFromKey(key), ceilingOffset);
    if (y + CELL_RADIUS >= LOSS_LINE_Y) return true;
  }
  return false;
}

export function isBoardCleared(board: Board): boolean {
  return board.size === 0;
}
