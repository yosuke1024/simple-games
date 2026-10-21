/**
 * Lanes, walls and free sets (docs/OVERTAKE_RULES.md §1 "車線", §5 "壁の幾何",
 * §5 "確かめる"). Integers only: with 3 / 4 / 5 lanes a lane is 12160 / 9120 /
 * 7296 units wide and every lane edge and centre is a whole unit — `exactDiv`
 * throws if a constant ever stops making that true.
 */
import {
  CAR_HALF_WIDTH,
  ROAD_LEFT,
  ROAD_WIDTH,
  SHOULDER_LEFT,
  SHOULDER_RIGHT,
  SHOULDER_SPEED,
  SUB,
  X_MAX,
  X_MAX_ROAD,
  X_MIN,
  X_MIN_ROAD,
} from './constants';
import { exactDiv } from './arith';
import { intersect, single, subtractOpen, type Intervals } from './intervals';
import { CAR_DIMENSIONS } from './levels';
import type { CarKind, Obstacle, Row } from './types';

export function laneWidth(lanes: number): number {
  return exactDiv(ROAD_WIDTH, lanes);
}

export function laneLeft(lanes: number, lane: number): number {
  return ROAD_LEFT + lane * laneWidth(lanes);
}

export function laneCenter(lanes: number, lane: number): number {
  return laneLeft(lanes, lane) + exactDiv(laneWidth(lanes), 2);
}

/** R(v) (§5): centres a car at constant speed v may use. */
export function speedRange(v: number): Intervals {
  return v > SHOULDER_SPEED ? single(X_MIN_ROAD, X_MAX_ROAD) : single(X_MIN, X_MAX);
}

export function carObstacle(kind: CarKind, centre: number, rear: number): Obstacle {
  const { width, length } = CAR_DIMENSIONS[kind];
  const half = exactDiv(width * SUB, 2);
  return { kind, left: centre - half, right: centre + half, rear, front: rear + length * SUB };
}

/** The cars of a wall whose gap is `gap` (§5 "壁の幾何"). */
export function wallCentres(lanes: number, gap: number, kind: CarKind): number[] {
  const half = exactDiv(CAR_DIMENSIONS[kind].width * SUB, 2);
  const centres: number[] = [];
  for (let lane = 0; lane < lanes; lane++) {
    if (lane === gap) continue;
    if (lanes === 5) {
      centres.push(laneCenter(lanes, lane));
    } else {
      const left = laneLeft(lanes, lane);
      centres.push(left + half, left + laneWidth(lanes) - half);
    }
  }
  return centres;
}

/** G_k (§5): the one uncovered stretch of [16, 344] px at least a car wide. */
export function wallGapSpan(lanes: number, gap: number, kind: CarKind): [number, number] {
  if (lanes === 5) {
    const half = exactDiv(CAR_DIMENSIONS[kind].width * SUB, 2);
    const lo = gap === 0 ? SHOULDER_LEFT : laneCenter(lanes, gap - 1) + half;
    const hi = gap === lanes - 1 ? SHOULDER_RIGHT : laneCenter(lanes, gap + 1) - half;
    return [lo, hi];
  }
  const lo = gap === 0 ? SHOULDER_LEFT : laneLeft(lanes, gap);
  const hi = gap === lanes - 1 ? SHOULDER_RIGHT : laneLeft(lanes, gap) + laneWidth(lanes);
  return [lo, hi];
}

/** B_k (§5): centres that fit in G_k, cut to R(420). */
export function wallBand(span: readonly [number, number]): Intervals {
  return intersect(
    single(span[0] + CAR_HALF_WIDTH, span[1] - CAR_HALF_WIDTH),
    single(X_MIN_ROAD, X_MAX_ROAD),
  );
}

/** F (§5): R(v) minus every obstacle widened by half a car (open, so touching is allowed). */
export function freeAmong(obstacles: readonly Obstacle[], range: Intervals): Intervals {
  let set = range;
  for (const o of obstacles) {
    set = subtractOpen(set, o.left - CAR_HALF_WIDTH, o.right + CAR_HALF_WIDTH);
    if (set.length === 0) break;
  }
  return set;
}

const fastCache = new WeakMap<Row, Intervals>();
const slowCache = new WeakMap<Row, Intervals>();

/** F_k at speed v, cached per row (rows are immutable). */
export function rowFree(row: Row, v: number): Intervals {
  const fast = v > SHOULDER_SPEED;
  const cache = fast ? fastCache : slowCache;
  let set = cache.get(row);
  if (set === undefined) {
    set = freeAmong(row.obstacles, speedRange(v));
    cache.set(row, set);
  }
  return set;
}

/**
 * The stretches of [16, 344] px (lateral, units) no obstacle of the row
 * covers — the quantity §5 "壁の幾何" and its test reason about.
 */
export function uncoveredSpans(obstacles: readonly Obstacle[]): Array<[number, number]> {
  let set: Intervals = single(SHOULDER_LEFT, SHOULDER_RIGHT);
  for (const o of obstacles) set = subtractOpen(set, o.left, o.right);
  const spans: Array<[number, number]> = [];
  for (let i = 0; i < set.length; i += 2) spans.push([set[i]!, set[i + 1]!]);
  return spans;
}
