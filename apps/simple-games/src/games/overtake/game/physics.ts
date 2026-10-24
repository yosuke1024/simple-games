/**
 * One fixed step of 1/120 s for one racer (docs/OVERTAKE_RULES.md §1 "1 ステップの
 * 順序", §4). The player and the rivals share it: steer → speed → advance →
 * resolve overlaps with traffic (a head-on hit is a Bump, a scrape along a
 * side is not) → cones → timers. Racers never touch each other (§4), so a
 * step only ever reads the course and the car itself. Sand, cones and scrapes
 * only cap the target speed at SHOULDER_SPEED: they are never a Bump (§4).
 *
 * Integers only (§1): positions in units, speeds in px/s, brake in ‰, and the
 * only division is Math.floor of two integers.
 */
import {
  ACCEL_PER_STEP,
  BRAKE_MAX,
  BRAKE_SPAN,
  BUMP_BLINK_STEPS,
  BUMP_HOLD_STEPS,
  BUMP_LOCK_STEPS,
  CAR_HALF_WIDTH,
  CONE_CAP_STEPS,
  CAR_LENGTH,
  DECEL_PER_STEP,
  FULL_SPEED,
  RESOLVE_PASS_LIMIT,
  ROAD_LEFT,
  ROAD_RIGHT,
  SHOULDER_SPEED,
  STEER_PER_STEP,
  X_MAX,
  X_MIN,
} from './constants';
import type { CarState, Course, Obstacle, StepInput, Zone, ZoneKind } from './types';

/** The mutable twin of CarState the hot loops use; `stepCar` is the pure face. */
export interface MutableCar {
  r: number;
  x: number;
  w: number;
  target: number;
  hold: number;
  lock: number;
  blink: number;
  bumps: number;
  coneCap: number;
}

export interface StepReport {
  /** A new Bump started this step. */
  bumped: boolean;
  /** The car overlapped traffic before resolution (blinking or not). */
  overlapped: boolean;
  /**
   * The contact was a scrape (§4, 2026-10-23): the car was already beside the
   * piece and steered into its side — pushed out sideways and capped like a
   * cone (4b), never a Bump. Set every step.
   */
  scraped: boolean;
  /** Candidate passes the resolution used (§4: at most RESOLVE_PASS_LIMIT). */
  passes: number;
  /** The resolution fell through to "back behind everything at this x". */
  pushedBack: boolean;
  /** The steering lock ended this step: re-anchor the steering finger (§3). */
  lockReleased: boolean;
  /** The car overlapped sand at step 2's position (set every step, §1). */
  onSand: boolean;
  /** The car overlapped a cone after the resolution: the cone cap restarted (set every step). */
  coneHit: boolean;
}

export function newReport(): StepReport {
  return {
    bumped: false,
    overlapped: false,
    scraped: false,
    passes: 0,
    pushedBack: false,
    lockReleased: false,
    onSand: false,
    coneHit: false,
  };
}

/**
 * Target speed for a brake in ‰ (§1): 420 − floor(360 × brake / 1000). A brake
 * that is not a whole number (input.ts never sends one) reads as 0.
 */
export function targetSpeed(brake: number): number {
  const b = Number.isSafeInteger(brake) ? Math.min(BRAKE_MAX, Math.max(0, brake)) : 0;
  return FULL_SPEED - Math.floor((BRAKE_SPAN * b) / BRAKE_MAX);
}

/** The smallest brake whose target speed is at most v (60 ≤ v ≤ 420). */
export function brakeForSpeed(v: number): number {
  if (v >= FULL_SPEED) return 0;
  return Math.min(BRAKE_MAX, Math.ceil(((FULL_SPEED - v) * BRAKE_MAX) / BRAKE_SPAN));
}

export function onShoulder(x: number): boolean {
  return x - CAR_HALF_WIDTH < ROAD_LEFT || x + CAR_HALF_WIDTH > ROAD_RIGHT;
}

/** w moves toward `goal` by +3 / −6 per step and never overshoots (§1). */
export function approachSpeed(w: number, goal: number): number {
  if (w < goal) return Math.min(goal, w + ACCEL_PER_STEP);
  if (w > goal) return Math.max(goal, w - DECEL_PER_STEP);
  return w;
}

const maxLengthCache = new WeakMap<Course, number>();
function longestObstacle(course: Course): number {
  let longest = maxLengthCache.get(course);
  if (longest === undefined) {
    longest = 0;
    for (const o of course.obstacles) longest = Math.max(longest, o.front - o.rear);
    maxLengthCache.set(course, longest);
  }
  return longest;
}

const longestZoneCache = new WeakMap<Course, number>();
function longestZone(course: Course): number {
  let longest = longestZoneCache.get(course);
  if (longest === undefined) {
    longest = 0;
    for (const z of course.zones) longest = Math.max(longest, z.front - z.rear);
    longestZoneCache.set(course, longest);
  }
  return longest;
}

/** Index of the first piece whose rear is ≥ r (pieces are sorted by rear). */
function firstRearAtOrAfter(obstacles: readonly { readonly rear: number }[], r: number): number {
  let lo = 0;
  let hi = obstacles.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (obstacles[mid]!.rear < r) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Calls `visit` for every obstacle whose extent along the course meets the
 * car's (r − 58, r) — open on both sides. Stops early when `visit` returns true.
 */
export function forEachNear(
  course: Course,
  r: number,
  visit: (o: Obstacle) => boolean | void,
): void {
  const obstacles = course.obstacles;
  const floor = r - CAR_LENGTH - longestObstacle(course);
  for (let i = firstRearAtOrAfter(obstacles, r) - 1; i >= 0; i--) {
    const o = obstacles[i]!;
    if (o.rear <= floor) break;
    if (o.front > r - CAR_LENGTH && visit(o) === true) return;
  }
}

/** The first obstacle the car at (x, r) overlaps in its interior (§4), or null. */
export function overlapAt(course: Course, x: number, r: number): Obstacle | null {
  let hit: Obstacle | null = null;
  const left = x - CAR_HALF_WIDTH;
  const right = x + CAR_HALF_WIDTH;
  forEachNear(course, r, (o) => {
    if (o.left < right && o.right > left) {
      hit = o;
      return true;
    }
    return false;
  });
  return hit;
}

/**
 * The first zone of this kind the car at (x, r) overlaps in its interior —
 * touching edges do not overlap (§4) — or null.
 */
export function zoneAt(course: Course, kind: ZoneKind, x: number, r: number): Zone | null {
  const zones = course.zones;
  if (zones.length === 0) return null;
  const left = x - CAR_HALF_WIDTH;
  const right = x + CAR_HALF_WIDTH;
  const back = r - CAR_LENGTH;
  const floor = back - longestZone(course);
  for (let i = firstRearAtOrAfter(zones, r) - 1; i >= 0; i--) {
    const z = zones[i]!;
    if (z.rear <= floor) break;
    if (z.kind === kind && z.front > back && z.left < right && z.right > left) return z;
  }
  return null;
}

/** Sand under the car at (x, r) (§4): the target speed is capped while it holds. */
export function onSandAt(course: Course, x: number, r: number): boolean {
  return zoneAt(course, 'sand', x, r) !== null;
}

/** A cone touching the car at (x, r) (§4): restarts the cone cap. */
export function onConeAt(course: Course, x: number, r: number): boolean {
  return zoneAt(course, 'cone', x, r) !== null;
}

function inRange(x: number): boolean {
  return x >= X_MIN && x <= X_MAX;
}

/**
 * "Back behind every piece of traffic overlapping at this x" (§4): the
 * largest r' ≤ r at which the car overlaps nothing, without moving sideways.
 */
function pushBack(course: Course, car: MutableCar): void {
  const left = car.x - CAR_HALF_WIDTH;
  const right = car.x + CAR_HALF_WIDTH;
  const obstacles = course.obstacles;
  const longest = longestObstacle(course);
  let r = car.r;
  // Obstacles sorted by rear: walk down from the car's front, pushing back
  // whenever one overlaps; a pushed car can only meet ones further back.
  for (let i = firstRearAtOrAfter(obstacles, r) - 1; i >= 0; i--) {
    const o = obstacles[i]!;
    if (o.rear + longest <= r - CAR_LENGTH) break;
    if (o.left < right && o.right > left && o.rear < r && o.front > r - CAR_LENGTH) r = o.rear;
  }
  car.r = r;
}

/**
 * Resolves every overlap (§4): for the first overlapping piece, try back /
 * left / right in order of distance (ties: back, left, right), never forward,
 * and take the first that lands clear of all traffic within the clamp. If none
 * does, push back. A candidate is only taken when it overlaps nothing, so one
 * pass always finishes the job; RESOLVE_PASS_LIMIT bounds the loop anyway.
 */
export function resolveOverlaps(
  course: Course,
  car: MutableCar,
  report: StepReport,
  passLimit: number = RESOLVE_PASS_LIMIT,
): void {
  for (;;) {
    const o = overlapAt(course, car.x, car.r);
    if (o === null) return;
    if (report.passes >= passLimit) break;
    report.passes += 1;
    const leftX = o.left - CAR_HALF_WIDTH;
    const rightX = o.right + CAR_HALF_WIDTH;
    const candidates = [
      { x: car.x, r: o.rear, d: car.r - o.rear },
      { x: leftX, r: car.r, d: car.x - leftX },
      { x: rightX, r: car.r, d: rightX - car.x },
    ];
    // Stable: equal distances keep the order back → left → right.
    candidates.sort((a, b) => a.d - b.d);
    const pick = candidates.find((c) => inRange(c.x) && overlapAt(course, c.x, c.r) === null);
    if (pick === undefined) break;
    car.x = pick.x;
    car.r = pick.r;
  }
  report.pushedBack = true;
  pushBack(course, car);
}

/** Advances one car by one step in place (§1 "1 ステップの順序"). */
export function advanceCar(
  course: Course,
  car: MutableCar,
  input: StepInput,
  report: StepReport = newReport(),
  passLimit: number = RESOLVE_PASS_LIMIT,
): StepReport {
  // 1. Steer. A target that is not a whole unit (input.ts never sends one) is
  // ignored like null, so nothing non-integer reaches the state (§1).
  if (car.lock === 0 && input.steerX !== null && Number.isSafeInteger(input.steerX)) {
    car.target = input.steerX;
  }
  if (car.x < car.target) car.x = Math.min(car.target, car.x + STEER_PER_STEP);
  else if (car.x > car.target) car.x = Math.max(car.target, car.x - STEER_PER_STEP);
  car.x = Math.min(X_MAX, Math.max(X_MIN, car.x));
  // 2. Speed. Shoulder, sand (at this pre-advance position) and a running
  // cone cap all cap the goal at the same 231 — they never stack (§1, §4).
  const sand = onSandAt(course, car.x, car.r);
  report.onSand = sand;
  if (car.hold > 0) {
    car.w = 0;
  } else {
    let goal = targetSpeed(input.brake);
    if (onShoulder(car.x) || sand || car.coneCap > 0) goal = Math.min(goal, SHOULDER_SPEED);
    car.w = approachSpeed(car.w, goal);
  }
  // 3. Advance.
  const before = car.r;
  car.r += car.w;
  // 4. Traffic. The first overlapping piece says what the contact is (§4,
  // 2026-10-23): a piece the car reached from behind on this step (its front
  // was at or behind the piece's rear before advancing), or one the
  // resolution has to move the car back from, is a head-on hit — a Bump
  // unless the car is blinking. Any other overlap means the car was already
  // beside the piece and steered into its side: a scrape, resolved sideways
  // and capped like a cone (4b), never a Bump.
  let fresh = false;
  let scraped = false;
  const hit = overlapAt(course, car.x, car.r);
  if (hit !== null) {
    report.overlapped = true;
    resolveOverlaps(course, car, report, passLimit);
    if (before <= hit.rear || car.r < before) {
      if (car.blink === 0) {
        fresh = true;
        report.bumped = true;
        car.bumps += 1;
        car.w = 0;
        car.hold = BUMP_HOLD_STEPS;
        car.lock = BUMP_LOCK_STEPS;
        car.blink = BUMP_BLINK_STEPS;
        // The steering lock holds the car where the resolution left it (§4).
        car.target = car.x;
      }
    } else {
      scraped = true;
    }
  }
  report.scraped = scraped;
  // 4b. Cones and scrapes, where the resolution left the car: a cone touch
  // or a scrape restarts the cap at 36; otherwise it counts down (5), Bump
  // step or not (§1).
  const cone = onConeAt(course, car.x, car.r);
  report.coneHit = cone;
  if (cone || scraped) car.coneCap = CONE_CAP_STEPS;
  else if (car.coneCap > 0) car.coneCap -= 1;
  // 5. Timers — a Bump's own step does not count against its timers.
  if (!fresh) {
    if (car.hold > 0) car.hold -= 1;
    if (car.lock > 0) {
      car.lock -= 1;
      if (car.lock === 0) report.lockReleased = true;
    }
    if (car.blink > 0) car.blink -= 1;
  }
  return report;
}

export function toMutable(car: CarState): MutableCar {
  return { ...car };
}

export function freeze(car: MutableCar): CarState {
  return {
    r: car.r,
    x: car.x,
    w: car.w,
    target: car.target,
    hold: car.hold,
    lock: car.lock,
    blink: car.blink,
    bumps: car.bumps,
    coneCap: car.coneCap,
  };
}

/** The pure step: a new car and what happened (§1 `step`). */
export function stepCar(
  course: Course,
  car: CarState,
  input: StepInput,
): { car: CarState; report: StepReport } {
  const next = toMutable(car);
  const report = advanceCar(course, next, input);
  return { car: freeze(next), report };
}

export function newCar(r: number, x: number, w: number): CarState {
  return { r, x, w, target: x, hold: 0, lock: 0, blink: 0, bumps: 0, coneCap: 0 };
}
