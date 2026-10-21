// @vitest-environment node
/**
 * `planLane` (docs/OVERTAKE_RULES.md §6, §17): what it reads, its gap speed
 * limits on every shipped course, and its work per decision.
 */
import { describe, expect, it } from 'vitest';
import {
  DECISION_INTERVAL,
  FULL_SPEED,
  MIN_TARGET_SPEED,
  PLAN_WORK_LIMIT,
  PLAYER_START,
  SPEED_GRID_STEP,
  SUB,
  VIEW_DISTANCE,
} from './constants';
import { generateCourse } from './course';
import { advanceCar, newReport, type MutableCar } from './physics';
import { brakingDistance, gapLimit, planLane } from './planner';
import { LEVELS, report } from './test-helpers';

describe('planLane (§6)', () => {
  // Arity only: three required parameters (course, own car, cap) and the
  // optional PlanOptions. That it reads no other racer is shown by the
  // no-rubber-band test in game/rivals.test.ts, not by this.
  it('has three required parameters and one optional (arity check only)', () => {
    expect(planLane.length).toBe(3);
  });

  it('is deterministic', () => {
    const course = generateCourse(42);
    const car = { r: 5000 * SUB, x: 150 * SUB, w: 380, hold: 0 };
    expect(planLane(course, car, 400)).toEqual(planLane(course, car, 400));
  });
});

describe('braking distance', () => {
  it('matches stepping −6 per step', () => {
    for (const [a, b] of [
      [420, 60],
      [420, 224],
      [300, 299],
      [100, 100],
      [61, 60],
    ] as const) {
      let w: number = a;
      let d = 0;
      while (w > b) {
        w = Math.max(b, w - 6);
        d += w;
      }
      expect(brakingDistance(a, b)).toBe(d);
    }
  });
});

describe('gap limits on every shipped course', () => {
  it('ask nothing (≥ 420) of normal and gate-1 gaps and something reachable (≥ 60) of every gate-2 gap', () => {
    let gateMin = Infinity;
    let gateMax = 0;
    let easyMin = Infinity;
    let otherMin = Infinity;
    for (const l of LEVELS) {
      const c = generateCourse(l);
      for (const row of c.rows) {
        if (row.index === 0) continue;
        const limit = gapLimit(c, row.index);
        if (row.kind === 'gate2') {
          expect(limit, `Lv${l} row ${row.index}`).toBeGreaterThanOrEqual(MIN_TARGET_SPEED);
          expect(limit).toBeLessThan(FULL_SPEED);
          gateMin = Math.min(gateMin, limit);
          gateMax = Math.max(gateMax, limit);
        } else if (row.kind === 'easy2') {
          easyMin = Math.min(easyMin, limit);
        } else {
          expect(limit, `Lv${l} row ${row.index}`).toBeGreaterThanOrEqual(FULL_SPEED);
          otherMin = Math.min(otherMin, limit);
        }
      }
    }
    report(
      'planner gap limit at gate pairs, px/s (min..max)',
      gateMin,
      gateMax,
      'easy pair min',
      easyMin,
      'normal and gate-1 min',
      otherMin,
    );
  });
});

describe('the work bound (§6, §17)', () => {
  it('stops at PLAN_WORK_LIMIT and returns the crawl decision honestly', () => {
    // A decision of bot A on Lv51 that had to try more than one speed.
    const course = generateCourse(51);
    const car: MutableCar = {
      r: PLAYER_START.r,
      x: PLAYER_START.x,
      w: 240,
      target: PLAYER_START.x,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
    };
    let decision = { steerX: car.x as number | null, brake: 0 };
    let slow: { car: MutableCar; work: number } | null = null;
    for (let step = 0; slow === null && car.r < course.length; step++) {
      if (step % DECISION_INTERVAL === 0) {
        const d = planLane(course, car, FULL_SPEED);
        expect(d.capped).toBe(false);
        if (d.speed < FULL_SPEED) slow = { car: { ...car }, work: d.work };
        decision = { steerX: d.steerX, brake: d.brake };
      }
      advanceCar(course, car, decision, newReport());
    }
    expect(slow).not.toBeNull();
    const { car: at, work } = slow!;
    expect(work).toBeLessThan(PLAN_WORK_LIMIT);
    // A bound below that decision's work: it stops before a later candidate.
    const capped = planLane(course, at, FULL_SPEED, { workLimit: 1 });
    expect([capped.feasible, capped.capped]).toEqual([false, true]);
    expect([capped.speed, capped.brake]).toEqual([MIN_TARGET_SPEED, 1000]);
    expect(capped.work).toBeLessThan(work);
    // A bound of 0 tries no candidate at all.
    const none = planLane(course, at, FULL_SPEED, { workLimit: 0 });
    expect([none.feasible, none.capped, none.work]).toEqual([false, true, 1]);
    // The default bound changes nothing.
    expect(planLane(course, at, FULL_SPEED, { workLimit: PLAN_WORK_LIMIT })).toEqual(
      planLane(course, at, FULL_SPEED),
    );
  });
});

describe('work per decision (§17)', () => {
  it('stays within segments × 19 speeds × (lanes + 1) intervals, and A never runs out of options', () => {
    let maxWork = 0;
    let infeasible = 0;
    let decisions = 0;
    const started = performance.now();
    for (const l of [1, 11, 21, 31, 51, 71, 100]) {
      const course = generateCourse(l);
      const car: MutableCar = {
        r: PLAYER_START.r,
        x: PLAYER_START.x,
        w: 240,
        target: PLAYER_START.x,
        hold: 0,
        lock: 0,
        blink: 0,
        bumps: 0,
      };
      let decision = { steerX: car.x as number | null, brake: 0 };
      for (let step = 0; car.r < course.length; step++) {
        if (step % DECISION_INTERVAL === 0) {
          const d = planLane(course, car, FULL_SPEED);
          decisions += 1;
          maxWork = Math.max(maxWork, d.work);
          if (!d.feasible) infeasible += 1;
          decision = { steerX: d.steerX, brake: d.brake };
        }
        advanceCar(course, car, decision, newReport());
      }
    }
    const rowsInView = Math.ceil(VIEW_DISTANCE / (116 * SUB)) + 1;
    const segments = 2 * rowsInView + 1;
    const speeds = (FULL_SPEED - MIN_TARGET_SPEED) / SPEED_GRID_STEP + 1;
    const bound = segments * speeds * (2 * (5 + 1) + 2);
    expect(speeds).toBe(19);
    expect(maxWork).toBeLessThanOrEqual(bound);
    expect(infeasible).toBe(0);
    report(
      'planLane: decisions',
      decisions,
      'max work',
      maxWork,
      `(structural bound ${bound})`,
      'µs per decision',
      ((1000 * (performance.now() - started)) / decisions).toFixed(1),
    );
  });
});
