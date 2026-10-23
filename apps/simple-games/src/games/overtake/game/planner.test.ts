// @vitest-environment node
/**
 * `planLane` (docs/OVERTAKE_RULES.md §6, §17): what it reads, its gap speed
 * limits on every shipped course, its work per decision, and how it treats
 * sand and cones (§6 "砂とコーン", 2026-10-22): avoided when a free lane can be
 * reached, driven through capped when not, and not even looked for when none
 * is in view.
 */
import { describe, expect, it } from 'vitest';
import {
  CAR_LENGTH,
  CONE_CAP_STEPS,
  DECISION_INTERVAL,
  FULL_SPEED,
  MIN_TARGET_SPEED,
  PLAN_WORK_LIMIT,
  PLAYER_START,
  SHOULDER_SPEED,
  SPEED_GRID_STEP,
  SUB,
  VIEW_DISTANCE,
  X_MIN,
} from './constants';
import { assembleCourse, coneGroup, generateCourse, sandZone } from './course';
import { laneCenter } from './geometry';
import { CONE_LENGTH, CONE_PITCH } from './levels';
import { advanceCar, newReport, type MutableCar } from './physics';
import { brakingDistance, gapLimit, lookAhead, planLane, type Decision } from './planner';
import { windowEnd, windowStart } from './route';
import { LEVELS, report } from './test-helpers';
import type { Course, Zone } from './types';

function startCar(r: number, x: number, w: number): MutableCar {
  return { r, x, w, target: x, hold: 0, lock: 0, blink: 0, bumps: 0, coneCap: 0 };
}

/** A synthetic 3-lane course of zone rows only (§16: built by hand, not generated). */
function zoneCourse(groups: readonly (readonly Zone[])[]): Course {
  const rows = groups.map((zones) => {
    const u = Math.min(...zones.map((z) => z.rear));
    const front = Math.max(...zones.map((z) => z.front));
    return {
      kind: 'normal' as const,
      template: zones[0]!.kind === 'sand' ? ('sand' as const) : ('cones' as const),
      u,
      length: front - u,
      gap: 0,
      lead: 0,
      sigma: 0,
      move: 0,
      obstacles: [],
      zones,
      gapSpan: null,
    };
  });
  return assembleCourse(16, 3, 8000 * SUB, rows);
}

interface Drive {
  readonly decisions: Decision[];
  readonly sandSteps: number;
  readonly coneTouches: number;
  readonly bumps: number;
  /** Fastest speed on a step with sand under the car or a running cone cap. */
  readonly cappedTop: number;
  /** Slowest speed after any step of the run. */
  readonly lowest: number;
}

/** Drives a car with planLane under `cap` (bot A's way, §6) until r passes `until`. */
function drive(course: Course, car: MutableCar, cap: number, until: number): Drive {
  const decisions: Decision[] = [];
  let input = { steerX: car.x as number | null, brake: 0 };
  let sandSteps = 0;
  let coneTouches = 0;
  let touching = false;
  let cappedTop = 0;
  let lowest = car.w;
  const rep = newReport();
  for (let step = 0; car.r < until; step++) {
    if (step % DECISION_INTERVAL === 0) {
      const d = planLane(course, car, cap);
      decisions.push(d);
      input = { steerX: d.steerX, brake: d.brake };
    }
    const capped = car.coneCap > 0;
    advanceCar(course, car, input, rep);
    if (rep.onSand) sandSteps += 1;
    if (rep.onSand || capped) cappedTop = Math.max(cappedTop, car.w);
    lowest = Math.min(lowest, car.w);
    if (rep.coneHit && !touching) coneTouches += 1;
    touching = rep.coneHit;
  }
  return { decisions, sandSteps, coneTouches, bumps: car.bumps, cappedTop, lowest };
}

describe('planLane (§6)', () => {
  // Arity only: three required parameters (course, own car, cap) and the
  // optional PlanOptions. That it reads no other racer is shown by the
  // no-rubber-band test in game/rivals.test.ts, not by this.
  it('has three required parameters and one optional (arity check only)', () => {
    expect(planLane.length).toBe(3);
  });

  it('is deterministic', () => {
    const course = generateCourse(42);
    const car = { r: 5000 * SUB, x: 150 * SUB, w: 380, hold: 0, coneCap: 0 };
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
  it('allow a precise driver through every gap at full speed after the human-spacing change', () => {
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
          expect(limit, `Lv${l} row ${row.index}`).toBeGreaterThanOrEqual(FULL_SPEED);
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
  }, 60_000);
});

describe('the work bound (§6, §17)', () => {
  it('stops at PLAN_WORK_LIMIT and returns the crawl decision honestly', () => {
    // Full-width sand makes the avoid-zones stage reject candidates before
    // allowing passage through the zone. Keep the work-cap test independent
    // of whether a shipped wall pair needs the perfect planner to slow down.
    const course = zoneCourse([
      [
        {
          kind: 'sand',
          left: 16 * SUB,
          right: 344 * SUB,
          rear: 2000 * SUB,
          front: 2250 * SUB,
        },
      ],
    ]);
    const at = startCar(1900 * SUB, 180 * SUB, FULL_SPEED);
    const uncapped = planLane(course, at, FULL_SPEED);
    expect(uncapped.feasible).toBe(true);
    expect(uncapped.capped).toBe(false);
    const work = uncapped.work;
    expect(work).toBeGreaterThan(1);
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
  it('stays within the structural bound 15 × 29 × 14 = 6,090 < PLAN_WORK_LIMIT on bot A over all 100 levels, never out of options', () => {
    let maxWork = 0;
    let maxLevel = 0;
    let infeasible = 0;
    let decisions = 0;
    let firstStage = 0;
    let shortestShipped = Infinity;
    const started = performance.now();
    for (const l of LEVELS) {
      const course = generateCourse(l);
      for (const row of course.rows) {
        shortestShipped = Math.min(shortestShipped, windowEnd(row) - windowStart(row));
      }
      const car = startCar(PLAYER_START.r, PLAYER_START.x, 240);
      let decision = { steerX: car.x as number | null, brake: 0 };
      for (let step = 0; car.r < course.length; step++) {
        if (step % DECISION_INTERVAL === 0) {
          const d = planLane(course, car, FULL_SPEED);
          decisions += 1;
          if (d.work > maxWork) {
            maxWork = d.work;
            maxLevel = l;
          }
          if (!d.feasible) infeasible += 1;
          if (d.stage === 1) firstStage += 1;
          decision = { steerX: d.steerX, brake: d.brake };
        }
        advanceCar(course, car, decision, newReport());
      }
    }
    // The shortest window is a 2-cone group's: 14 + 16 px of cones + 58 = 88 px
    // (§6 "仕事量"), so 480 px of view meets at most 7 rows — 15 segments. The
    // shipped courses are measured too, so a shorter row added to the
    // generator fails here instead of silently voiding the bound.
    const shortestWindow = (CONE_LENGTH + CONE_PITCH) * SUB + CAR_LENGTH;
    expect(shortestWindow).toBe(88 * SUB);
    expect(shortestShipped).toBe(shortestWindow);
    const rowsInView = Math.ceil(VIEW_DISTANCE / shortestWindow) + 1;
    const segments = 2 * rowsInView + 1;
    const speeds = (FULL_SPEED - MIN_TARGET_SPEED) / SPEED_GRID_STEP + 1;
    const fast = Math.floor((FULL_SPEED - SHOULDER_SPEED - 1) / SPEED_GRID_STEP) + 1;
    const bound = segments * (fast + speeds) * (2 * (5 + 1) + 2);
    expect([segments, fast, speeds, bound]).toEqual([15, 10, 19, 6090]);
    expect(PLAN_WORK_LIMIT).toBeGreaterThan(bound);
    expect(maxWork).toBeLessThanOrEqual(bound);
    expect(infeasible).toBe(0);
    report(
      'planLane (bot A, 100 levels): decisions',
      decisions,
      'first-stage decisions',
      firstStage,
      'max work',
      maxWork,
      `(Lv${maxLevel}; structural bound ${bound}, PLAN_WORK_LIMIT ${PLAN_WORK_LIMIT})`,
      'shortest window on the shipped courses (px)',
      shortestShipped / SUB,
      'µs per decision',
      ((1000 * (performance.now() - started)) / decisions).toFixed(1),
    );
  }, 60_000);
});

describe('sand and cones (§6 "砂とコーン")', () => {
  it('(a) routes around sand and cones a free lane can reach: no sand step, no cone touch, no Bump', () => {
    // The car starts in the middle lane, sand ahead in it; then a cone group
    // on the right of the left lane, where the sand's avoidance leaves it.
    const sand = sandZone(3, 1, 200, 2000 * SUB);
    const cones = coneGroup(3, 0, 1, 3, 3000 * SUB);
    const course = zoneCourse([[sand], cones]);
    const car = startCar(1000 * SUB, laneCenter(3, 1), FULL_SPEED);
    const run = drive(course, car, FULL_SPEED, 4000 * SUB);
    expect(run.decisions.every((d) => d.feasible)).toBe(true);
    expect([run.sandSteps, run.coneTouches, run.bumps]).toEqual([0, 0, 0]);
    const first = run.decisions.filter((d) => d.stage === 1).length;
    expect(first).toBeGreaterThan(0);
    // Full throttle throughout: avoiding costs no speed here — no decision
    // brakes and the speed never leaves 420 on any step of the run.
    expect(Math.max(...run.decisions.map((d) => d.brake))).toBe(0);
    expect(run.lowest).toBe(FULL_SPEED);
    expect(car.w).toBe(FULL_SPEED);
    report('planLane avoids: decisions', run.decisions.length, 'first stage', first);
  });

  it('(b) drives through sand that covers the whole road, capped at 231, feasible and without a Bump', () => {
    // The generator never lays this (sand is one lane wide, §5); planLane must
    // still pass it: stage 1 finds nothing, stage 2 drives on.
    const wide = [0, 1, 2].map((lane) => sandZone(3, lane, 250, 2000 * SUB));
    const course = zoneCourse([wide]);
    const car = startCar(1000 * SUB, laneCenter(3, 1), FULL_SPEED);
    const run = drive(course, car, FULL_SPEED, 3000 * SUB);
    expect(run.decisions.every((d) => d.feasible)).toBe(true);
    expect(run.decisions.some((d) => d.stage === 2 && d.speed > SHOULDER_SPEED)).toBe(true);
    expect(run.bumps).toBe(0);
    expect(run.sandSteps).toBeGreaterThan(0);
    // Once on the sand the speed falls to the cap and stays there (§4).
    const onSand = drive(
      course,
      startCar(2000 * SUB + 100 * SUB, laneCenter(3, 1), SHOULDER_SPEED),
      FULL_SPEED,
      2000 * SUB + 250 * SUB,
    );
    expect(onSand.cappedTop).toBe(SHOULDER_SPEED);
    expect(onSand.decisions.every((d) => d.feasible)).toBe(true);
    report('planLane through full-width sand: steps on sand', run.sandSteps);
  });

  it('(c) skips the first stage when no sand or cone is in view: the same decision and work as without them', () => {
    let compared = 0;
    let inView = 0;
    let firstInView = 0;
    for (const l of [6, 16, 51, 100]) {
      const course = generateCourse(l);
      const bare = assembleCourse(
        l,
        course.lanes,
        course.length,
        course.rows.map((row) => ({ ...row, zones: [] })),
        course.gatePairs,
      );
      expect(course.zones.length).toBeGreaterThan(0);
      const car = startCar(PLAYER_START.r, PLAYER_START.x, 240);
      let decision = { steerX: car.x as number | null, brake: 0 };
      for (let step = 0; car.r < course.length; step++) {
        if (step % DECISION_INTERVAL === 0) {
          const d = planLane(course, car, FULL_SPEED);
          const seen = course.rows.some(
            (row) =>
              row.zones.length > 0 &&
              windowEnd(row) > car.r &&
              windowStart(row) < car.r + VIEW_DISTANCE,
          );
          if (seen) {
            inView += 1;
            if (d.stage === 1) firstInView += 1;
          } else {
            expect(d.stage === 1).toBe(false);
            expect(d).toEqual(planLane(bare, car, FULL_SPEED));
            compared += 1;
          }
          decision = { steerX: d.steerX, brake: d.brake };
        }
        advanceCar(course, car, decision, newReport());
      }
    }
    expect(compared).toBeGreaterThan(0);
    expect(firstInView).toBeGreaterThan(0);
    report(
      'planLane: decisions with nothing in view (equal to the bare course)',
      compared,
      'with zones in view',
      inView,
      'of them first stage',
      firstInView,
    );
  });

  it('reads PlanCar.coneCap: the look-ahead caps like step does, position for position', () => {
    const sand = sandZone(3, 1, 200, 2000 * SUB);
    const cones = coneGroup(3, 0, 0, 3, 3000 * SUB);
    const course = zoneCourse([[sand], cones]);
    const cases: Array<[string, MutableCar]> = [
      ['open road', startCar(1500 * SUB, laneCenter(3, 1), 400)],
      ['entering sand', startCar(2000 * SUB - 3 * SUB, laneCenter(3, 1), 400)],
      ['leaving sand', startCar(2258 * SUB - 2 * SUB, laneCenter(3, 1), 240)],
      ['on the shoulder', startCar(1500 * SUB, X_MIN, 400)],
      ['cone cap running', { ...startCar(1500 * SUB, laneCenter(3, 1), 400), coneCap: 2 }],
      [
        'cone cap full',
        { ...startCar(1500 * SUB, laneCenter(3, 1), 400), coneCap: CONE_CAP_STEPS },
      ],
      ['meeting a cone', startCar(3000 * SUB - SUB, cones[0]!.right, 380)],
      ['in a Bump hold', { ...startCar(1500 * SUB, laneCenter(3, 1), 0), hold: 2 }],
    ];
    for (const [name, car] of cases) {
      for (const brake of [0, 500, 1000]) {
        const real: number[] = [];
        const moving = { ...car };
        for (let j = 0; j < DECISION_INTERVAL; j++) {
          advanceCar(course, moving, { steerX: car.x, brake }, newReport());
          real.push(moving.r);
        }
        expect(lookAhead(course, car, brake), `${name}, brake ${brake}`).toEqual(real);
      }
    }
    // The cap is read from the car: the same state without it runs further.
    const capped = { ...startCar(1500 * SUB, laneCenter(3, 1), 400), coneCap: CONE_CAP_STEPS };
    const free = { ...capped, coneCap: 0 };
    expect(lookAhead(course, capped, 0)[3]!).toBeLessThan(lookAhead(course, free, 0)[3]!);
  });
});
