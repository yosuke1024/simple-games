// @vitest-environment node
/**
 * The loss structure (docs/OVERTAKE_RULES.md §4 "損の構造", §16): on every
 * level from Lv11, one Bump at a required-slowdown pair costs at least twice
 * what slowing down for it costs. Measured with `step`, on a synthetic course
 * holding only that pair — the one with the longest D_k of the level — so no
 * other row leaks into either loss.
 *
 * Three runs from 1,000 px before the first wall at full speed, centred in
 * its band, all steering the same way (to the first band's edge nearest the
 * second until the first window ends, then to the second band's near edge):
 * (i) the least slowdown — brake late enough to reach v_check exactly as the
 * first window ends, hold it through D_k, full throttle once inside the
 * second window; (ii) full throttle throughout (Rusher); (iii) full throttle
 * on the same stretch with no traffic. Loss = steps to 1,000 px past the
 * second window minus run (iii)'s.
 */
import { describe, expect, it } from 'vitest';
import { FULL_SPEED, STEPS_PER_SECOND, SUB } from './constants';
import { assembleCourse, generateCourse } from './course';
import { wallBand } from './geometry';
import { levelSpec } from './levels';
import {
  advanceCar,
  approachSpeed,
  brakeForSpeed,
  newReport,
  targetSpeed,
  type MutableCar,
} from './physics';
import { brakingDistance } from './planner';
import { windowEnd } from './route';
import { report } from './test-helpers';
import type { Course } from './types';

type Brake = 'least' | 'none';

function measure(
  course: Course,
  level: number,
): { least: number; rush: number; free: number; bumpsLeast: number; bumpsRush: number } {
  const rows = course.rows;
  let k = -1;
  for (const row of rows)
    if (row.kind === 'gate2' && (k < 0 || row.lead > rows[k]!.lead)) k = row.index;
  const first = rows[k - 1]!;
  const second = rows[k]!;
  const pair = assembleCourse(level, course.lanes, course.length, [first, second]);
  const empty = assembleCourse(level, course.lanes, course.length, []);
  const b1 = wallBand(first.gapSpan!);
  const b2 = wallBand(second.gapSpan!);
  const right = b2[0]! > b1[1]!;
  const edge1 = right ? b1[1]! : b1[0]!;
  const edge2 = right ? b2[0]! : b2[1]!;
  const end1 = windowEnd(first);
  const finish = windowEnd(second) + 1000 * SUB;
  const vCheck = levelSpec(level).checkSpeed;

  const run = (c: Course, brake: Brake): { steps: number; bumps: number } => {
    const car: MutableCar = {
      r: first.u - 1000 * SUB,
      x: Math.floor((b1[0]! + b1[1]!) / 2),
      w: FULL_SPEED,
      target: 0,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
    };
    car.target = car.x;
    let braking = false;
    for (let step = 1; step < 20_000; step++) {
      let b = 0;
      if (brake === 'least' && car.r <= second.u) {
        if (!braking && end1 - car.r <= brakingDistance(car.w, vCheck) + 2 * car.w) braking = true;
        if (braking) b = brakeForSpeed(vCheck);
      }
      const next = car.hold > 0 ? 0 : approachSpeed(car.w, targetSpeed(b));
      const steerX = car.r + next >= end1 ? edge2 : edge1;
      advanceCar(c, car, { steerX, brake: b }, newReport());
      if (car.r >= finish) return { steps: step, bumps: car.bumps };
    }
    throw new Error('did not finish');
  };

  const least = run(pair, 'least');
  const rush = run(pair, 'none');
  const free = run(empty, 'none');
  return {
    least: least.steps - free.steps,
    rush: rush.steps - free.steps,
    free: free.steps,
    bumpsLeast: least.bumps,
    bumpsRush: rush.bumps,
  };
}

describe('a Bump costs at least twice the slowdown (§4)', () => {
  it('holds on every level Lv11–100', () => {
    let worstRatio = Infinity;
    let worstLevel = 0;
    let leastMax = 0;
    let rushMin = Infinity;
    for (let l = 11; l <= 100; l++) {
      const m = measure(generateCourse(l), l);
      expect(m.bumpsLeast, `Lv${l} least`).toBe(0);
      expect(m.bumpsRush, `Lv${l} rush`).toBe(1);
      expect(m.least, `Lv${l}`).toBeGreaterThan(0);
      expect(m.rush, `Lv${l}`).toBeGreaterThanOrEqual(2 * m.least);
      if (m.rush / m.least < worstRatio) {
        worstRatio = m.rush / m.least;
        worstLevel = l;
      }
      leastMax = Math.max(leastMax, m.least);
      rushMin = Math.min(rushMin, m.rush);
    }
    const s = (steps: number) => (steps / STEPS_PER_SECOND).toFixed(3);
    report('loss: smallest Bump / slowdown ratio', `${worstRatio.toFixed(2)} (Lv${worstLevel})`);
    report(
      'loss: slowdown at most',
      `${leastMax} steps = ${s(leastMax)} s`,
      'Bump at least',
      `${rushMin} steps = ${s(rushMin)} s`,
    );
  });
});
