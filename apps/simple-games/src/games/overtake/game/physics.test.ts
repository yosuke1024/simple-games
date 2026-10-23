// @vitest-environment node
/**
 * The step (docs/OVERTAKE_RULES.md §1 "1 ステップの順序", §4): speeds, steering,
 * shoulders, Bump timers, and the overlap resolution that never moves a car
 * forward.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUMP_BLINK_STEPS,
  BUMP_HOLD_STEPS,
  BUMP_LOCK_STEPS,
  CAR_HALF_WIDTH,
  CAR_LENGTH,
  CONE_CAP_STEPS,
  FULL_SPEED,
  MAX_RACE_STEPS,
  PLAYER_START,
  ROLLING_START_SPEED,
  SHOULDER_SPEED,
  SUB,
  X_MAX,
  X_MIN,
} from './constants';
import { controllerFor } from './bots';
import { assembleCourse, coneGroup, generateCourse, sandZone } from './course';
import { carObstacle, laneCenter } from './geometry';
import {
  advanceCar,
  approachSpeed,
  brakeForSpeed,
  newReport,
  onConeAt,
  onSandAt,
  overlapAt,
  resolveOverlaps,
  stepCar,
  targetSpeed,
  type MutableCar,
} from './physics';
import { createRng, randInt } from './rng';
import { report } from './test-helpers';
import type { Course, Obstacle, Zone } from './types';

function car(r: number, x: number, w: number): MutableCar {
  return { r, x, w, target: x, hold: 0, lock: 0, blink: 0, bumps: 0, coneCap: 0 };
}

/** A course holding just these obstacles (as one row each). */
function scene(obstacles: Obstacle[]): Course {
  return assembleCourse(
    1,
    3,
    100_000 * SUB,
    obstacles.map((o) => ({
      kind: 'normal' as const,
      template: 'single' as const,
      u: o.rear,
      length: o.front - o.rear,
      gap: 0,
      lead: 0,
      sigma: 0,
      move: 0,
      obstacles: [o],
      gapSpan: null,
    })),
  );
}

const EMPTY = scene([]);

/** A course holding these zones as one 'sand' / 'cones' row, plus optional traffic rows. */
function zoneScene(zones: Zone[], obstacles: Obstacle[] = []): Course {
  const u = Math.min(...zones.map((z) => z.rear));
  return assembleCourse(1, 3, 100_000 * SUB, [
    {
      kind: 'normal' as const,
      template: zones[0]!.kind === 'sand' ? ('sand' as const) : ('cones' as const),
      u,
      length: Math.max(...zones.map((z) => z.front)) - u,
      gap: 0,
      lead: 0,
      sigma: 0,
      move: 0,
      obstacles: [],
      zones,
      gapSpan: null,
    },
    ...obstacles.map((o) => ({
      kind: 'normal' as const,
      template: 'single' as const,
      u: o.rear,
      length: o.front - o.rear,
      gap: 0,
      lead: 0,
      sigma: 0,
      move: 0,
      obstacles: [o],
      gapSpan: null,
    })),
  ]);
}

describe('speed (§1)', () => {
  it('maps the brake to 420 − floor(360 × brake / 1000)', () => {
    expect([0, 1, 500, 999, 1000, 5000, -3].map(targetSpeed)).toEqual([
      420, 420, 240, 61, 60, 60, 420,
    ]);
    for (let v = 60; v <= 420; v++) {
      const b = brakeForSpeed(v);
      expect(targetSpeed(b)).toBeLessThanOrEqual(v);
      if (b > 0) expect(targetSpeed(b - 1)).toBeGreaterThan(v);
    }
  });

  it('accelerates +3 and brakes −6 per step without overshooting', () => {
    expect(approachSpeed(240, 420)).toBe(243);
    expect(approachSpeed(419, 420)).toBe(420);
    expect(approachSpeed(420, 60)).toBe(414);
    expect(approachSpeed(63, 60)).toBe(60);
    const c = car(0, 180 * SUB, 240);
    let steps = 0;
    while (c.w < FULL_SPEED) {
      advanceCar(EMPTY, c, { steerX: null, brake: 0 });
      steps += 1;
    }
    expect(steps).toBe(60);
    steps = 0;
    while (c.w > 60) {
      advanceCar(EMPTY, c, { steerX: null, brake: 1000 });
      steps += 1;
    }
    expect(steps).toBe(60);
  });

  it('advances r by w units per step', () => {
    const c = car(0, 180 * SUB, 300);
    advanceCar(EMPTY, c, { steerX: null, brake: brakeForSpeed(300) });
    expect(c.r).toBe(300);
  });
});

describe('steering and the clamp (§1)', () => {
  it('moves at most 440 units a step toward the target, and keeps the target on null', () => {
    const c = car(0, 100 * SUB, 0);
    advanceCar(EMPTY, c, { steerX: 200 * SUB, brake: 1000 });
    expect(c.x).toBe(100 * SUB + 440);
    advanceCar(EMPTY, c, { steerX: null, brake: 1000 });
    expect(c.x).toBe(100 * SUB + 880);
    expect(c.target).toBe(200 * SUB);
    const near = car(0, 200 * SUB - 100, 0);
    advanceCar(EMPTY, near, { steerX: 200 * SUB, brake: 1000 });
    expect(near.x).toBe(200 * SUB);
  });

  it('clamps the centre to [33, 327] px', () => {
    const c = car(0, 40 * SUB, 0);
    for (let i = 0; i < 10; i++) advanceCar(EMPTY, c, { steerX: 0, brake: 1000 });
    expect(c.x).toBe(X_MIN);
    for (let i = 0; i < 200; i++) advanceCar(EMPTY, c, { steerX: 400 * SUB, brake: 1000 });
    expect(c.x).toBe(X_MAX);
  });

  it('caps the speed at 231 on a shoulder, without a Bump', () => {
    const c = car(0, 40 * SUB, 420);
    for (let i = 0; i < 100; i++) advanceCar(EMPTY, c, { steerX: null, brake: 0 });
    expect(c.w).toBe(SHOULDER_SPEED);
    expect(c.bumps).toBe(0);
    // Body fully on the road (centre 45 px): no cap.
    const road = car(0, 45 * SUB, 300);
    for (let i = 0; i < 100; i++) advanceCar(EMPTY, road, { steerX: null, brake: 0 });
    expect(road.w).toBe(FULL_SPEED);
  });
});

describe('sand (§1 step 2, §4)', () => {
  const sand = sandZone(3, 1, 200, 1000 * SUB);
  const course = zoneScene([sand]);
  const mid = laneCenter(3, 1);

  it('caps the target speed at 231 while the body overlaps it, even at brake 0, and lets go after', () => {
    // A deep copy: course.zones holds the same Zone objects as `sand`, so only
    // a snapshot catches the physics moving or reshaping one in place.
    const zonesBefore = JSON.parse(JSON.stringify(course.zones)) as Zone[];
    const c = car(sand.rear - 300 * SUB, mid, FULL_SPEED);
    let sandSteps = 0;
    let lowest = FULL_SPEED;
    const r0 = c.r;
    let steps = 0;
    while (c.r < sand.front + CAR_LENGTH + 400 * SUB) {
      const before = { r: c.r, x: c.x, w: c.w };
      const rep = advanceCar(course, c, { steerX: null, brake: 0 });
      steps += 1;
      // Never a Bump, never resolved: r moves by exactly w, x never moves.
      expect(rep.bumped || rep.overlapped || rep.coneHit).toBe(false);
      expect(c.r).toBe(before.r + c.w);
      expect(c.x).toBe(mid);
      // The cap is judged at step 2's position (before the advance), strictly.
      const inside = before.r > sand.rear && before.r - CAR_LENGTH < sand.front;
      expect(rep.onSand, `step ${steps}`).toBe(inside);
      if (inside) expect(c.w).toBe(Math.max(SHOULDER_SPEED, before.w - 6));
      else expect(c.w).toBe(Math.min(FULL_SPEED, before.w + 3));
      if (rep.onSand) sandSteps += 1;
      lowest = Math.min(lowest, c.w);
    }
    expect(lowest).toBe(SHOULDER_SPEED);
    expect(c.w).toBe(FULL_SPEED);
    expect([c.bumps, c.hold, c.lock, c.blink, c.coneCap]).toEqual([0, 0, 0, 0, 0]);
    expect(course.zones).toEqual(zonesBefore);
    expect(c.r).toBeGreaterThan(r0);
    report('sand 200 px at full throttle, steps on sand', sandSteps);
  });

  it('does not cap a car whose edge only touches it (sideways or end on)', () => {
    // Right edge exactly on the sand's left edge.
    const side = car(sand.rear + 100 * SUB, sand.left - CAR_HALF_WIDTH, FULL_SPEED);
    for (let i = 0; i < 100; i++) {
      expect(advanceCar(course, side, { steerX: null, brake: 0 }).onSand).toBe(false);
    }
    expect(side.w).toBe(FULL_SPEED);
    expect(onSandAt(course, sand.left - CAR_HALF_WIDTH, sand.rear + 100 * SUB)).toBe(false);
    expect(onSandAt(course, sand.left - CAR_HALF_WIDTH + 1, sand.rear + 100 * SUB)).toBe(true);
    // Front exactly on the sand's rear, back exactly on its front: no overlap.
    expect(onSandAt(course, mid, sand.rear)).toBe(false);
    expect(onSandAt(course, mid, sand.rear + 1)).toBe(true);
    expect(onSandAt(course, mid, sand.front + CAR_LENGTH)).toBe(false);
    expect(onSandAt(course, mid, sand.front + CAR_LENGTH - 1)).toBe(true);
    // The first step that starts with the front on the sand's rear is not capped.
    const end = car(sand.rear, mid, FULL_SPEED);
    const first = advanceCar(course, end, { steerX: null, brake: 0 });
    expect([first.onSand, end.w]).toEqual([false, FULL_SPEED]);
    const second = advanceCar(course, end, { steerX: null, brake: 0 });
    expect([second.onSand, end.w]).toEqual([true, FULL_SPEED - 6]);
  });

  it('is not traffic: overlapAt and the resolution ignore it, a Bump on it is the usual Bump', () => {
    expect(overlapAt(course, mid, sand.rear + 100 * SUB)).toBeNull();
    const sedan = carObstacle('sedan', mid, sand.rear + 150 * SUB);
    const mixed = zoneScene([sand], [sedan]);
    const c = car(sedan.rear - 300 * SUB, mid, FULL_SPEED);
    let bumpedAt = -1;
    for (let step = 1; step < 400 && bumpedAt < 0; step++) {
      if (advanceCar(mixed, c, { steerX: null, brake: 0 }).bumped) bumpedAt = step;
    }
    expect(bumpedAt).toBeGreaterThan(0);
    expect([c.w, c.hold, c.lock, c.blink, c.bumps]).toEqual([0, 60, 36, 96, 1]);
    // Resolved behind the sedan — onto the sand, which is allowed (§4).
    expect(c.r).toBe(sedan.rear);
    expect(onSandAt(mixed, c.x, c.r)).toBe(true);
  });
});

describe('cones (§1 steps 4–5, §4)', () => {
  // Three lanes, the middle lane, three cones from its left edge.
  const group = coneGroup(3, 1, 0, 3, 1000 * SUB);
  const course = zoneScene(group);
  const middle = group[1]!;
  const x = (middle.left + middle.right) / 2;

  it('restarts a 36-step cap on every touching step; the 37th step after the last touch is free', () => {
    expect(CONE_CAP_STEPS).toBe(36);
    // At 231 the cap holds w exactly, so its end shows as the first +3. Until
    // the first touch, brake 525 ‰ holds the same 231 (420 − 189).
    expect(targetSpeed(525)).toBe(SHOULDER_SPEED);
    // A deep copy: course.zones holds the same Zone objects as `group`.
    const zonesBefore = JSON.parse(JSON.stringify(course.zones)) as Zone[];
    const c = car(middle.rear - 200 * SUB, x, SHOULDER_SPEED);
    let lastTouch = -1;
    let touches = 0;
    let freedAt = -1;
    for (let step = 1; step < 400 && freedAt < 0; step++) {
      const before = { r: c.r, x: c.x };
      const rep = advanceCar(course, c, { steerX: null, brake: lastTouch < 0 ? 525 : 0 });
      expect(rep.bumped || rep.overlapped || rep.onSand).toBe(false);
      expect([c.r, c.x]).toEqual([before.r + c.w, before.x]);
      expect(rep.coneHit).toBe(onConeAt(course, c.x, c.r));
      if (rep.coneHit) {
        touches += 1;
        lastTouch = step;
        expect(c.coneCap).toBe(36);
      } else if (lastTouch > 0) {
        expect(c.coneCap, `step ${step}`).toBe(Math.max(0, 36 - (step - lastTouch)));
      }
      if (lastTouch > 0 && c.w > SHOULDER_SPEED) freedAt = step;
      else expect(c.w).toBe(SHOULDER_SPEED);
    }
    expect(c.w).toBe(SHOULDER_SPEED + 3);
    expect(touches).toBeGreaterThan(1);
    expect(freedAt - lastTouch).toBe(37);
    expect([c.bumps, c.hold, c.lock, c.blink]).toEqual([0, 0, 0, 0]);
    // The cones stay where they were (§4: not pushed, not removed).
    expect(course.zones).toEqual(zonesBefore);
    report('3-cone group at 231, touching steps', touches);
  });

  it('starts from a car at a 231 speed only when the cap is up: no cone, full throttle accelerates', () => {
    const c = car(0, x, SHOULDER_SPEED);
    advanceCar(EMPTY, c, { steerX: null, brake: 0 });
    expect(c.w).toBe(SHOULDER_SPEED + 3);
    const capped = { ...car(0, x, SHOULDER_SPEED), coneCap: 5 };
    advanceCar(EMPTY, capped, { steerX: null, brake: 0 });
    expect([capped.w, capped.coneCap]).toEqual([SHOULDER_SPEED, 4]);
  });

  it('counts down through a Bump step and resolves only traffic', () => {
    // A running cap counts down on the Bump's own step too (§1 step 5).
    const lone = carObstacle('sedan', x, 3000 * SUB);
    const plain = scene([lone]);
    const c = { ...car(lone.rear - 20 * SUB, x, FULL_SPEED), coneCap: 36 };
    let bumpStep = -1;
    for (let step = 1; step < 30 && bumpStep < 0; step++) {
      if (advanceCar(plain, c, { steerX: null, brake: 0 }).bumped) bumpStep = step;
    }
    expect(bumpStep).toBeGreaterThan(0);
    expect(c.coneCap).toBe(36 - bumpStep);
    // A sedan just past the cones: the resolution puts the car back behind it,
    // over the cones (they are not traffic), and the cap restarts there.
    const sedan = carObstacle('sedan', x, middle.front + 30 * SUB);
    const mixed = zoneScene(group, [sedan]);
    expect(overlapAt(mixed, x, middle.front)).toBeNull();
    const d = car(middle.rear - 100 * SUB, x, FULL_SPEED);
    let bumped = false;
    for (let step = 1; step < 400 && !bumped; step++) {
      const rep = advanceCar(mixed, d, { steerX: null, brake: 0 });
      if (rep.bumped) {
        bumped = true;
        expect(d.r).toBe(sedan.rear);
        expect(rep.coneHit).toBe(true);
        expect(d.coneCap).toBe(36);
      }
    }
    expect(bumped).toBe(true);
    expect(d.bumps).toBe(1);
  });

  it('caps at 231 however many apply at once: shoulder, sand, cone timer', () => {
    // A sand strip on the left shoulder-side lane, the car half on the shoulder, cone cap running.
    const sand = sandZone(3, 0, 250, 1000 * SUB);
    const c = { ...car(sand.rear + 100 * SUB, 40 * SUB, FULL_SPEED), coneCap: 30 };
    const course2 = zoneScene([sand]);
    for (let i = 0; i < 40; i++) {
      const rep = advanceCar(course2, c, { steerX: null, brake: 0 });
      expect(rep.onSand).toBe(true);
    }
    expect(c.w).toBe(SHOULDER_SPEED);
    // And the brake still goes below it.
    advanceCar(course2, c, { steerX: null, brake: 1000 });
    expect(c.w).toBe(SHOULDER_SPEED - 6);
  });
});

describe('Bump (§4)', () => {
  const sedan = carObstacle('sedan', 180 * SUB, 1000 * SUB);
  const course = scene([sedan]);

  function driveIn(): { c: MutableCar; at: number } {
    const c = car(1000 * SUB - 300, 180 * SUB, 420);
    for (let step = 1; step < 100; step++) {
      const rep = advanceCar(course, c, { steerX: null, brake: 0 });
      if (rep.bumped) return { c, at: step };
    }
    throw new Error('never bumped');
  }

  it('stops the car, holds 60 steps, locks steering 36, blinks 96, counts once', () => {
    // The literal values of §1 / §4, not only the constants.
    expect([BUMP_HOLD_STEPS, BUMP_LOCK_STEPS, BUMP_BLINK_STEPS]).toEqual([60, 36, 96]);
    const { c } = driveIn();
    expect(c.bumps).toBe(1);
    expect(c.w).toBe(0);
    expect([c.hold, c.lock, c.blink]).toEqual([60, 36, 96]);
    expect(c.r).toBeLessThanOrEqual(sedan.rear);
    expect(overlapAt(course, c.x, c.r)).toBeNull();
    // Hold: exactly 60 more steps at w = 0 whatever the throttle, then it rolls again.
    let held = 0;
    let releasedAt = -1;
    const x0 = c.x;
    for (let step = 1; step <= 100; step++) {
      const rep = advanceCar(course, c, { steerX: 10 * SUB, brake: 0 });
      if (c.w === 0) held += 1;
      if (step <= 60) expect(c.w, `step ${step}`).toBe(0);
      if (step === 61) expect(c.w).toBeGreaterThan(0);
      if (rep.lockReleased) releasedAt = step;
      if (step <= 36) expect(c.x).toBe(x0);
      // The blink counts down 96 steps after the Bump's.
      expect(c.blink, `step ${step}`).toBe(Math.max(0, 96 - step));
    }
    expect(held).toBe(60);
    expect(releasedAt).toBe(36);
    expect(c.x).toBeLessThan(x0);
  });

  it('can Bump again exactly at the 97th step after a Bump, not before', () => {
    // Straight on into the same sedan: from the end of the hold every step
    // overlaps and is pushed back; the first that counts is step 97.
    const { c } = driveIn();
    let again = -1;
    for (let step = 1; step <= 120 && again < 0; step++) {
      const rep = advanceCar(course, c, { steerX: null, brake: 0 });
      if (rep.bumped) again = step;
      else if (step > 60) expect(rep.overlapped, `step ${step}`).toBe(true);
    }
    expect(again).toBe(97);
    expect(c.bumps).toBe(2);
  });

  it('does not count a second overlap while blinking, but still resolves it', () => {
    const { c } = driveIn();
    // Wait out the hold, then drive straight back into the same car.
    for (let i = 0; i < BUMP_HOLD_STEPS; i++) advanceCar(course, c, { steerX: null, brake: 0 });
    let overlaps = 0;
    for (let i = 0; i < 30 && c.blink > 0; i++) {
      const rep = advanceCar(course, c, { steerX: null, brake: 0 });
      if (rep.overlapped) overlaps += 1;
      expect(rep.bumped).toBe(false);
      expect(overlapAt(course, c.x, c.r)).toBeNull();
    }
    expect(overlaps).toBeGreaterThan(0);
    expect(c.bumps).toBe(1);
    // Once the blink is over, the next contact is a new Bump.
    while (c.blink > 0) advanceCar(course, c, { steerX: null, brake: 0 });
    let again = false;
    for (let i = 0; i < 200 && !again; i++)
      again = advanceCar(course, c, { steerX: null, brake: 0 }).bumped;
    expect(again).toBe(true);
    expect(c.bumps).toBe(2);
  });

  it('resolves sideways when that is the smaller move (never forward)', () => {
    // Clip the sedan's left edge by 2 px from behind-left: left is the smaller move.
    const c = car(1000 * SUB + 30 * SUB, sedan.left - CAR_HALF_WIDTH + 2 * SUB, 0);
    const rep = newReport();
    resolveOverlaps(course, c, rep);
    expect(c.x).toBe(sedan.left - CAR_HALF_WIDTH);
    expect(c.r).toBe(1000 * SUB + 30 * SUB);
    expect(rep.passes).toBe(1);
  });
});

describe('overlap resolution never moves a car forward (§4)', () => {
  it('holds over 3,000 random overlaps on real courses, in one pass or the push back', () => {
    const rng = createRng('overtake-resolve');
    let passesMax = 0;
    let pushedBack = 0;
    for (let trial = 0; trial < 3000; trial++) {
      const level = 1 + randInt(rng, 100);
      const c = generateCourse(level);
      const o = c.obstacles[randInt(rng, c.obstacles.length)]!;
      const x =
        o.left - CAR_HALF_WIDTH + 1 + randInt(rng, o.right - o.left + 2 * CAR_HALF_WIDTH - 1);
      const r = o.rear + 1 + randInt(rng, o.front - o.rear + CAR_LENGTH - 1);
      const m = car(r, Math.min(X_MAX, Math.max(X_MIN, x)), 0);
      if (overlapAt(c, m.x, m.r) === null) continue;
      const rep = newReport();
      resolveOverlaps(c, m, rep);
      expect(m.r).toBeLessThanOrEqual(r);
      expect(overlapAt(c, m.x, m.r)).toBeNull();
      expect(m.x).toBeGreaterThanOrEqual(X_MIN);
      expect(m.x).toBeLessThanOrEqual(X_MAX);
      passesMax = Math.max(passesMax, rep.passes);
      if (rep.pushedBack) pushedBack += 1;
    }
    expect(passesMax).toBe(1);
    report('random overlaps: most passes', passesMax, 'push-backs', pushedBack);
  }, 60_000);

  it('(c) pushes back behind everything at this x when no candidate is clear', () => {
    // A car hard against the right clamp, overlapping A; left of it sits B,
    // behind it sits C: back, left and right are all taken.
    const x = X_MAX;
    const a = {
      kind: 'sedan' as const,
      left: x - 1000,
      right: x + 4000,
      rear: 5000 * SUB,
      front: 5058 * SUB,
    };
    const b = {
      kind: 'sedan' as const,
      left: a.left - 2 * CAR_HALF_WIDTH - 4000,
      right: a.left - 10,
      rear: 4990 * SUB,
      front: 5100 * SUB,
    };
    const cc = {
      kind: 'sedan' as const,
      left: x - 3000,
      right: x + 3000,
      rear: 4900 * SUB,
      front: 4960 * SUB,
    };
    const course = scene([a, b, cc]);
    const m = car(5010 * SUB, x, 0);
    expect(overlapAt(course, m.x, m.r)).toBe(a);
    const rep = newReport();
    resolveOverlaps(course, m, rep);
    expect(rep.pushedBack).toBe(true);
    expect(m.x).toBe(x);
    expect(m.r).toBe(cc.rear);
    expect(overlapAt(course, m.x, m.r)).toBeNull();
    // The pass bound itself: with no pass allowed, the push back is all that runs.
    const n = car(5010 * SUB, x, 0);
    const limited = newReport();
    resolveOverlaps(course, n, limited, 0);
    expect(limited.passes).toBe(0);
    expect(limited.pushedBack).toBe(true);
    expect(n.r).toBeLessThan(5010 * SUB);
  });
});

describe('scrape (§4, 2026-10-23)', () => {
  const sedan = carObstacle('sedan', 180 * SUB, 3000 * SUB);
  const course = scene([sedan]);
  const wallX = sedan.left - CAR_HALF_WIDTH;

  it('(a) side contact while beside is a scrape, never a Bump', () => {
    expect(CONE_CAP_STEPS).toBe(36);
    const c = car(sedan.rear + 20 * SUB, wallX, FULL_SPEED);
    const target = wallX + 100 * SUB;
    let beside = 0;
    let cleared = 0;
    let w = c.w;
    for (let i = 1; i <= 400 && c.coneCap + (cleared === 0 ? 1 : 0) > 0; i++) {
      const prevR = c.r;
      const rep = advanceCar(course, c, { steerX: target, brake: 0 });
      expect(c.r).toBeGreaterThanOrEqual(prevR);
      expect(c.bumps).toBe(0);
      expect(rep.bumped).toBe(false);
      if (c.r - CAR_LENGTH < sedan.front) {
        beside += 1;
        expect(rep.scraped, `step ${i}`).toBe(true);
        expect(rep.overlapped).toBe(true);
        expect(c.x).toBe(wallX);
        expect(c.coneCap).toBe(36);
        // Step 1 still has no cap (it starts at the step's end); then −6 a step to 231.
        expect(c.w, `step ${i}`).toBe(Math.max(SHOULDER_SPEED, FULL_SPEED - 6 * (beside - 1)));
      } else {
        cleared += 1;
        expect(rep.scraped).toBe(false);
        expect(rep.overlapped).toBe(false);
        expect(c.coneCap).toBe(Math.max(0, 36 - cleared));
        expect(c.w).toBe(Math.max(SHOULDER_SPEED, w - 6));
      }
      w = c.w;
    }
    expect(beside).toBeGreaterThan(20);
    expect(c.coneCap).toBe(0);
    // The cap is over: the speed climbs back to full.
    for (let i = 0; i < 200 && c.w < FULL_SPEED; i++) {
      const prev = c.w;
      advanceCar(course, c, { steerX: target, brake: 0 });
      expect(c.w).toBe(Math.min(FULL_SPEED, prev + 3));
    }
    expect(c.w).toBe(FULL_SPEED);
    report('scrape (a): steps beside the sedan', beside);
  });

  it('(b) reaching a piece from behind is a Bump even when the resolution goes sideways', () => {
    // Front 1 px behind the sedan's rear; the 440-unit steer leaves the right edge
    // 120 units (1 px) inside its left edge, the advance 300 units inside its rear.
    const c = car(sedan.rear - SUB, wallX - 320, FULL_SPEED);
    const rep = advanceCar(course, c, { steerX: wallX + 100 * SUB, brake: 0 });
    expect(rep.bumped).toBe(true);
    expect(rep.scraped).toBe(false);
    expect(rep.pushedBack).toBe(false);
    expect(c.x).toBe(wallX);
    expect(c.bumps).toBe(1);
    expect([c.hold, c.lock, c.blink]).toEqual([60, 36, 96]);
    expect(c.w).toBe(0);
    expect(overlapAt(course, c.x, c.r)).toBeNull();
  });

  it('(c) a side contact while blinking is a scrape, not a second Bump', () => {
    // The sideways Bump of (b) leaves the car beside the sedan; once the hold is
    // over it steers into the side again, 100 units a step, still blinking.
    const c = car(sedan.rear - SUB, wallX - 320, FULL_SPEED);
    advanceCar(course, c, { steerX: wallX + 100 * SUB, brake: 0 });
    expect(c.bumps).toBe(1);
    for (let i = 0; i < BUMP_HOLD_STEPS; i++) advanceCar(course, c, { steerX: null, brake: 0 });
    expect(c.blink).toBe(36);
    let scrapes = 0;
    while (c.blink > 0) {
      const rep = advanceCar(course, c, { steerX: c.x + 100, brake: 0 });
      expect(rep.bumped).toBe(false);
      expect(rep.scraped).toBe(true);
      expect(rep.overlapped).toBe(true);
      expect(c.bumps).toBe(1);
      expect(c.coneCap).toBe(36);
      scrapes += 1;
    }
    expect(scrapes).toBe(36);
  });

  it('(d) a push back counts as a Bump', () => {
    // The wedged arrangement of "(c) pushes back behind everything" above.
    const x = X_MAX;
    const a = {
      kind: 'sedan' as const,
      left: x - 1000,
      right: x + 4000,
      rear: 5000 * SUB,
      front: 5058 * SUB,
    };
    const b = {
      kind: 'sedan' as const,
      left: a.left - 2 * CAR_HALF_WIDTH - 4000,
      right: a.left - 10,
      rear: 4990 * SUB,
      front: 5100 * SUB,
    };
    const cc = {
      kind: 'sedan' as const,
      left: x - 3000,
      right: x + 3000,
      rear: 4900 * SUB,
      front: 4960 * SUB,
    };
    const wedge = scene([a, b, cc]);
    const m = car(5010 * SUB, x, 0);
    const rep = advanceCar(wedge, m, { steerX: null, brake: 0 });
    expect(rep.pushedBack).toBe(true);
    expect(rep.bumped).toBe(true);
    expect(rep.scraped).toBe(false);
    expect(m.bumps).toBe(1);
    expect(m.r).toBe(cc.rear);
  });

  it('(e) bot A never scrapes on the shipped courses (rivals not measured)', () => {
    const counts: string[] = [];
    for (const l of [1, 11, 21, 51, 100]) {
      const course2 = generateCourse(l);
      const controller = controllerFor(course2, 'A');
      const m = car(PLAYER_START.r, PLAYER_START.x, ROLLING_START_SPEED);
      const rep = newReport();
      let scrapes = 0;
      for (let step = 0; step < MAX_RACE_STEPS && m.r < course2.length; step++) {
        advanceCar(course2, m, controller.next(step, m), rep);
        if (rep.scraped) scrapes += 1;
      }
      expect(m.r, `Lv${l}`).toBeGreaterThanOrEqual(course2.length);
      expect(scrapes, `Lv${l}`).toBe(0);
      expect(m.bumps, `Lv${l}`).toBe(0);
      counts.push(`Lv${l} ${scrapes}`);
    }
    report('scraped steps of bot A', counts.join('  '));
  }, 60_000);
});

describe('the pure step', () => {
  it('does not mutate its input and returns integers only', () => {
    const course = generateCourse(23);
    const before = {
      r: 700 * SUB,
      x: 180 * SUB,
      w: 400,
      target: 180 * SUB,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
      coneCap: 7,
    };
    const frozen = { ...before };
    const { car: after, report: rep } = stepCar(course, before, { steerX: 200 * SUB, brake: 250 });
    expect(before).toEqual(frozen);
    expect(Object.keys(after)).toContain('coneCap');
    // This car is already beside a wall car and steers into its side: a scrape
    // (§4, 2026-10-23), so no Bump and the cap restarts at 36 instead of 7 → 6.
    expect(rep.scraped).toBe(true);
    expect(after.bumps).toBe(0);
    expect(after.coneCap).toBe(36);
    for (const v of Object.values(after)) expect(Number.isInteger(v)).toBe(true);
  });
});

describe('game/ stays clock-free and integer-safe (§1, §16 仕事量)', () => {
  it('has no Math.random, Date, performance or transcendental math outside tests', () => {
    const dir = new URL('.', import.meta.url).pathname;
    const sources = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && !f.includes('.test.') && f !== 'test-helpers.ts',
    );
    expect(sources.length).toBeGreaterThan(10);
    for (const file of sources) {
      const text = readFileSync(join(dir, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      for (const banned of [
        'Math.random',
        'Date',
        'performance',
        'Math.sin',
        'Math.cos',
        'Math.pow',
        'Math.exp',
        'Math.sqrt',
        '**',
      ]) {
        expect(text.includes(banned), `${file}: ${banned}`).toBe(false);
      }
    }
  });
});
