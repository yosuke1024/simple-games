/**
 * `planLane` (docs/OVERTAKE_RULES.md §6): the one pure planner the rivals and
 * every reference bot drive with. It reads the course and the car it steers —
 * never another racer — so a rival's run depends on (course, its own state,
 * its own speed cap) and nothing else.
 *
 * Per decision (every DECISION_INTERVAL steps):
 *
 * 1. The view ahead is cut into segments: each row's window (u_k, u_k + L_k +
 *    58) and the gaps between them (§5 "行の窓").
 * 2. Speed: candidates from the cap down by 20 px/s (≥ 60). A candidate v is
 *    taken when (a) the car can still brake to every upcoming gap's speed
 *    limit before reaching it, and (b) the route sweep of §5 — the same R(v),
 *    the same widening before and through each window — passes over the view
 *    with each segment crossed at the fastest speed the car may have there.
 *    A gap's limit is the fastest constant speed at which its lateral move
 *    (between the two windows' free sets) fits once the decision lag is paid.
 * 3. Steering: forward sets (reachable) ∩ backward sets (still finishing the
 *    view) give the feasible positions at every segment boundary. The target
 *    is the nearest point (to the car) of the first boundary set the car is
 *    not in — the least lateral movement, started as early as possible —
 *    projected onto the end of the current segment, then clamped so that
 *    holding it for the decision's steps never meets traffic.
 *
 * The decision is held for DECISION_INTERVAL steps, so wherever a constraint
 * relaxes (a window ends) the car can lose up to DECISION_LAG steps before it
 * moves on; the sweep charges every such gap that lag (§6, §18).
 *
 * Work is bounded by structure (§17): segments in view × candidates ×
 * intervals per set (lanes + 1 at most). On top of that, PLAN_WORK_LIMIT is a
 * hard cap checked before each candidate: at the cap the planner returns its
 * crawl decision honestly (`feasible: false`, `capped: true`) instead of
 * going on — the node-limit pattern of docs/GAME_LIFECYCLE.md「CPU 探索」.
 */
import {
  CAR_LENGTH,
  DECEL_PER_STEP,
  DECISION_INTERVAL,
  DECISION_LAG,
  FULL_SPEED,
  MIN_TARGET_SPEED,
  PLAN_WORK_LIMIT,
  SHOULDER_SPEED,
  SPEED_GRID_STEP,
  STEER_PER_STEP,
  VIEW_DISTANCE,
  X_MAX,
  X_MIN,
} from './constants';
import { exactDiv } from './arith';
import { freeAmong, rowFree, speedRange } from './geometry';
import {
  componentOf,
  contains,
  distance,
  expandWithin,
  intersect,
  nearest,
  single,
  type Intervals,
} from './intervals';
import { approachSpeed, brakeForSpeed, forEachNear, onShoulder, targetSpeed } from './physics';
import { windowEnd, windowStart } from './route';
import type { Course, Obstacle, Row } from './types';

export interface PlanCar {
  readonly r: number;
  readonly x: number;
  readonly w: number;
  readonly hold: number;
}

export interface PlanOptions {
  /** View window ahead of the car, units (default 480 px). */
  readonly view?: number;
  /** Added to the goal before it is projected onto the feasible set (a bot's lateral noise, §6). */
  readonly aimOffset?: number;
  /** Work bound override (tests only; default PLAN_WORK_LIMIT). */
  readonly workLimit?: number;
}

export interface Decision {
  readonly steerX: number;
  readonly brake: number;
  /** The constant speed the decision chose, px/s. */
  readonly speed: number;
  /** False when no candidate passed and the planner fell back to its slowest, safest guess. */
  readonly feasible: boolean;
  /** True when the fallback came from the work bound rather than from every candidate failing. */
  readonly capped: boolean;
  /** Interval operations performed (§17). */
  readonly work: number;
}

interface Segment {
  readonly start: number;
  readonly end: number;
  readonly row: Row | null;
  /** For a gap: its speed limit (Infinity when it asks nothing). */
  readonly limit: number;
}

/** Distance (units) covered while braking from a to b ≤ a at −6 per step. */
export function brakingDistance(a: number, b: number): number {
  if (a <= b) return 0;
  const n = Math.ceil((a - b) / DECEL_PER_STEP);
  return (n - 1) * a - exactDiv(DECEL_PER_STEP * (n - 1) * n, 2) + b;
}

/**
 * Braking from w toward v < w at −6 per step: the speed of the step that
 * carries the car past `distance` units — the fastest it can be from there on.
 */
export function speedAt(w: number, v: number, distance: number): number {
  if (distance <= 0) return w;
  let speed = w;
  let covered = 0;
  while (speed > v) {
    speed = Math.max(v, speed - DECEL_PER_STEP);
    covered += speed;
    if (covered >= distance) return speed;
  }
  return v;
}

const limitCache = new WeakMap<Course, number[]>();

function limitFor(lead: number, from: Intervals, to: Intervals): number {
  const move = distance(from, to);
  if (move === 0) return Infinity;
  if (move === Infinity) return 0;
  const steps = Math.ceil(move / STEER_PER_STEP) + DECISION_LAG;
  return Math.floor(lead / steps);
}

/**
 * Speed limit of the gap before row k (k ≥ 1): the fastest speed at which some
 * point of row k − 1's free set reaches row k's while paying the decision lag.
 */
export function gapLimit(course: Course, k: number): number {
  let limits = limitCache.get(course);
  if (limits === undefined) {
    limits = course.rows.map((row, i) => {
      if (i === 0) return Infinity;
      const prev = course.rows[i - 1]!;
      const fast = limitFor(row.lead, rowFree(prev, FULL_SPEED), rowFree(row, FULL_SPEED));
      if (fast > SHOULDER_SPEED) return fast;
      const slow = limitFor(
        row.lead,
        rowFree(prev, MIN_TARGET_SPEED),
        rowFree(row, MIN_TARGET_SPEED),
      );
      return Math.max(fast, Math.min(slow, SHOULDER_SPEED));
    });
    limitCache.set(course, limits);
  }
  return limits[k] ?? Infinity;
}

/** Index of the first row whose window ends after r. */
function firstRowAfter(rows: readonly Row[], r: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (windowEnd(rows[mid]!) <= r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function segmentsAhead(course: Course, r: number, view: number): Segment[] {
  const segments: Segment[] = [];
  const horizon = r + view;
  let pos = r;
  let k = firstRowAfter(course.rows, r);
  for (; k < course.rows.length; k++) {
    const row = course.rows[k]!;
    const start = windowStart(row);
    if (start >= horizon) break;
    if (start > pos)
      segments.push({ start: pos, end: start, row: null, limit: gapLimit(course, k) });
    segments.push({ start: Math.max(pos, start), end: windowEnd(row), row, limit: Infinity });
    pos = windowEnd(row);
  }
  if (pos < horizon) {
    const limit = k < course.rows.length ? gapLimit(course, k) : Infinity;
    segments.push({ start: pos, end: horizon, row: null, limit });
  }
  return segments;
}

interface Sweep {
  readonly forward: Intervals[];
  readonly free: Intervals[];
  readonly reach: number[];
  readonly work: number;
}

/** The forward sweep for candidate v, or null when the view cannot be crossed (§6 step 2). */
function sweepAt(segments: readonly Segment[], car: PlanCar, v: number): Sweep | null {
  const w = car.w;
  let set: Intervals = single(car.x, car.x);
  const forward: Intervals[] = [];
  const free: Intervals[] = [];
  const reach: number[] = [];
  let work = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    let u = w > v ? speedAt(w, v, seg.start - car.r) : v;
    if (seg.row === null && seg.limit < u && seg.start > car.r) {
      u = Math.max(seg.limit, MIN_TARGET_SPEED);
    }
    const f = seg.row === null ? speedRange(u) : rowFree(seg.row, u);
    set = intersect(set, f);
    work += 1 + exactDiv(f.length, 2);
    if (set.length === 0) return null;
    const lag = i > 0 && seg.row === null ? DECISION_LAG : 0;
    const steps = Math.floor((seg.end - seg.start) / u);
    const r = STEER_PER_STEP * Math.max(0, steps - lag);
    set = expandWithin(set, r, f);
    forward.push(set);
    free.push(f);
    reach.push(r);
  }
  return { forward, free, reach, work };
}

/** (a) of step 2: can the car still brake to each upcoming gap's limit in time? */
function canBrakeFor(segments: readonly Segment[], car: PlanCar, v: number): boolean {
  const fastest = Math.max(car.w, v);
  for (const seg of segments) {
    if (seg.row !== null || seg.limit >= v) continue;
    if (seg.start <= car.r) return false;
    const margin = (DECISION_INTERVAL + 1) * fastest;
    if (
      brakingDistance(fastest, Math.max(seg.limit, MIN_TARGET_SPEED)) + margin >
      seg.start - car.r
    ) {
      return false;
    }
  }
  return true;
}

/** Free centres at front position r against the real traffic (what the physics sees). */
function freeAt(course: Course, r: number): Intervals {
  const near: Obstacle[] = [];
  forEachNear(course, r, (o) => {
    near.push(o);
  });
  return freeAmong(near, single(X_MIN, X_MAX));
}

/**
 * Clamps a lateral aim so that following it for the decision's steps never
 * puts the car into traffic (§6 step 3).
 */
function safeTarget(course: Course, car: PlanCar, aim: number, brake: number): number {
  const dir = Math.sign(aim - car.x);
  if (dir === 0) return car.x;
  let allowed = Math.abs(aim - car.x);
  let w = car.w;
  let r = car.r;
  let hold = car.hold;
  const goal = targetSpeed(brake);
  for (let j = 1; j <= DECISION_INTERVAL; j++) {
    if (hold > 0) {
      w = 0;
      hold -= 1;
    } else {
      w = approachSpeed(w, onShoulder(car.x) ? Math.min(goal, SHOULDER_SPEED) : goal);
    }
    r += w;
    const comp = componentOf(freeAt(course, r), car.x);
    if (comp === null) break;
    const edge = dir > 0 ? comp[1] - car.x : car.x - comp[0];
    if (j * STEER_PER_STEP > edge) allowed = Math.min(allowed, edge);
  }
  return car.x + dir * allowed;
}

function candidates(cap: number): number[] {
  const top = Math.max(MIN_TARGET_SPEED, Math.min(FULL_SPEED, cap));
  const out: number[] = [];
  for (let v = top; v >= MIN_TARGET_SPEED; v -= SPEED_GRID_STEP) out.push(v);
  return out;
}

export function planLane(
  course: Course,
  car: PlanCar,
  cap: number,
  options: PlanOptions = {},
): Decision {
  const view = options.view ?? VIEW_DISTANCE;
  const offset = options.aimOffset ?? 0;
  const workLimit = options.workLimit ?? PLAN_WORK_LIMIT;
  const segments = segmentsAhead(course, car.r, Math.max(view, CAR_LENGTH));
  let work = 0;
  let capped = false;
  for (const v of candidates(cap)) {
    if (work >= workLimit) {
      capped = true;
      break;
    }
    if (!canBrakeFor(segments, car, v)) {
      work += 1;
      continue;
    }
    const sweep = sweepAt(segments, car, v);
    if (sweep === null) {
      work += segments.length;
      continue;
    }
    work += sweep.work;
    // Backward: the set each boundary must hit for the rest of the view to pass.
    const n = segments.length;
    const exitNeeded: Intervals[] = new Array<Intervals>(n);
    let need: Intervals = sweep.free[n - 1]!;
    for (let i = n - 1; i >= 0; i--) {
      exitNeeded[i] = need;
      need = expandWithin(intersect(need, sweep.free[i]!), sweep.reach[i]!, sweep.free[i]!);
      work += 1;
    }
    let goal = car.x;
    for (let i = 0; i < n; i++) {
      const feasible = intersect(sweep.forward[i]!, exitNeeded[i]!);
      if (feasible.length === 0) continue;
      if (!contains(feasible, car.x)) {
        goal = nearest(feasible, car.x);
        break;
      }
    }
    // Project the goal onto the feasible set at the end of the current
    // segment — or, when the current segment is a window that ends within
    // this decision's hold, onto the next one: the safety clamp below keeps
    // the car clear of that window, and the move starts on the step it ends
    // instead of a decision later. A bot's noise shifts what it aims at,
    // never where it may be (§6).
    const horizon = car.r + DECISION_INTERVAL * Math.max(car.w, v);
    let p = 0;
    while (p < n - 1 && segments[p]!.row !== null && segments[p]!.end <= horizon) p += 1;
    const firstSet = intersect(sweep.forward[p]!, exitNeeded[p]!);
    const aim = firstSet.length > 0 ? nearest(firstSet, goal + offset) : goal;
    const brake = brakeForSpeed(v);
    return {
      steerX: safeTarget(course, car, aim, brake),
      brake,
      speed: v,
      feasible: true,
      capped: false,
      work,
    };
  }
  // Nothing passes (or the work bound was reached): crawl, and head for the
  // nearest opening of the next row.
  const brake = brakeForSpeed(MIN_TARGET_SPEED);
  let aim = car.x;
  for (const seg of segments) {
    if (seg.row === null) continue;
    const f = rowFree(seg.row, MIN_TARGET_SPEED);
    if (f.length > 0) {
      aim = nearest(f, car.x);
      break;
    }
  }
  return {
    steerX: safeTarget(course, car, aim + offset, brake),
    brake,
    speed: MIN_TARGET_SPEED,
    feasible: false,
    capped,
    work: work + 1,
  };
}
