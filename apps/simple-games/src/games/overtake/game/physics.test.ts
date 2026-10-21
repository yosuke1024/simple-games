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
  FULL_SPEED,
  SHOULDER_SPEED,
  SUB,
  X_MAX,
  X_MIN,
} from './constants';
import { assembleCourse, generateCourse } from './course';
import { carObstacle } from './geometry';
import {
  advanceCar,
  approachSpeed,
  brakeForSpeed,
  newReport,
  overlapAt,
  resolveOverlaps,
  stepCar,
  targetSpeed,
  type MutableCar,
} from './physics';
import { createRng, randInt } from './rng';
import { report } from './test-helpers';
import type { Course, Obstacle } from './types';

function car(r: number, x: number, w: number): MutableCar {
  return { r, x, w, target: x, hold: 0, lock: 0, blink: 0, bumps: 0 };
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
  });

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
    };
    const frozen = { ...before };
    const { car: after } = stepCar(course, before, { steerX: 200 * SUB, brake: 250 });
    expect(before).toEqual(frozen);
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
