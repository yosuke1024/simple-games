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
 *
 * Sand and cones (§4 "砂とコーンの損", 2026-10-22) are measured the same way on
 * a synthetic course holding one zone row (3 lanes, middle lane): full
 * throttle from 1,000 px before it to 1,000 px past its window, against the
 * same run on an empty course. The order of §4 "損の順序" is asserted: Bump
 * (the 90-level minimum) ≥ 2 × the 3-cone group run, Bump > sand 250, and
 * every zone loss > 0 with no Bump.
 */
import { describe, expect, it } from 'vitest';
import { CAR_HALF_WIDTH, FULL_SPEED, STEER_PER_STEP, STEPS_PER_SECOND, SUB } from './constants';
import { assembleCourse, coneGroup, generateCourse, sandZone } from './course';
import { laneCenter, wallBand } from './geometry';
import { CONE_LENGTH, CONE_WIDTH, levelSpec } from './levels';
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
import type { Course, StepInput, Zone } from './types';

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
      coneCap: 0,
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

interface GateLosses {
  worstRatio: number;
  worstLevel: number;
  leastMax: number;
  rushMin: number;
}

let gateLosses: GateLosses | null = null;
/** The wall-pair losses of every level Lv11–100, measured once for both describes. */
function allGateLosses(): GateLosses {
  if (gateLosses !== null) return gateLosses;
  const out: GateLosses = { worstRatio: Infinity, worstLevel: 0, leastMax: 0, rushMin: Infinity };
  for (let l = 11; l <= 100; l++) {
    const m = measure(generateCourse(l), l);
    expect(m.bumpsLeast, `Lv${l} least`).toBe(0);
    expect(m.bumpsRush, `Lv${l} rush`).toBe(1);
    expect(m.least, `Lv${l}`).toBeGreaterThan(0);
    expect(m.rush, `Lv${l}`).toBeGreaterThanOrEqual(2 * m.least);
    if (m.rush / m.least < out.worstRatio) {
      out.worstRatio = m.rush / m.least;
      out.worstLevel = l;
    }
    out.leastMax = Math.max(out.leastMax, m.least);
    out.rushMin = Math.min(out.rushMin, m.rush);
  }
  gateLosses = out;
  return out;
}

const s = (steps: number) => (steps / STEPS_PER_SECOND).toFixed(3);

describe('a Bump costs at least twice the slowdown (§4)', () => {
  it('holds on every level Lv11–100', () => {
    const { worstRatio, worstLevel, leastMax, rushMin } = allGateLosses();
    report('loss: smallest Bump / slowdown ratio', `${worstRatio.toFixed(2)} (Lv${worstLevel})`);
    report(
      'loss: slowdown at most',
      `${leastMax} steps = ${s(leastMax)} s`,
      'Bump at least',
      `${rushMin} steps = ${s(rushMin)} s`,
    );
  });
});

interface ZoneRun {
  loss: number;
  bumps: number;
  coneSteps: number;
  sandSteps: number;
}

/**
 * One zone row at u = 2,000 px on 3 lanes; full throttle from 1,000 px
 * before it to 1,000 px past its window, `steer` deciding the input. Loss is
 * against the same inputs on an empty course.
 */
function zoneLoss(zones: Zone[], start: number, steer: (car: MutableCar) => number): ZoneRun {
  const u = Math.min(...zones.map((z) => z.rear));
  const front = Math.max(...zones.map((z) => z.front));
  const row = {
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
  const withZones = assembleCourse(16, 3, 40_000 * SUB, [row]);
  const empty = assembleCourse(16, 3, 40_000 * SUB, []);
  const finish = withZones.rows[0]!.u + withZones.rows[0]!.length + (58 + 1000) * SUB;
  const run = (c: Course) => {
    const car: MutableCar = {
      r: u - 1000 * SUB,
      x: start,
      w: FULL_SPEED,
      target: start,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
      coneCap: 0,
    };
    let coneSteps = 0;
    let sandSteps = 0;
    for (let step = 1; step < 20_000; step++) {
      const input: StepInput = { steerX: steer(car), brake: 0 };
      const rep = advanceCar(c, car, input, newReport());
      if (rep.coneHit) coneSteps += 1;
      if (rep.onSand) sandSteps += 1;
      if (car.r >= finish) return { steps: step, bumps: car.bumps, coneSteps, sandSteps };
    }
    throw new Error('did not finish');
  };
  const a = run(withZones);
  const b = run(empty);
  expect(b.coneSteps + b.sandSteps).toBe(0);
  return {
    loss: a.steps - b.steps,
    bumps: a.bumps,
    coneSteps: a.coneSteps,
    sandSteps: a.sandSteps,
  };
}

describe('sand and cones cost far less than a Bump (§4 "損の順序")', () => {
  const U = 2000 * SUB;
  const lane = 1;
  const centre = laneCenter(3, lane);

  it('Bump ≥ 2 × the 3-cone group, Bump > sand 250, every zone loss > 0 with no Bump', () => {
    const { rushMin, leastMax } = allGateLosses();
    // (a) The 3-cone group, straight through the middle cone's centre: the
    // car overlaps all three (p = 19 px < 17 + 6), 46 + 58 = 104 px of travel.
    const group = coneGroup(3, lane, 0, 3, U);
    const mid = (group[1]!.left + group[1]!.right) / 2;
    const three = zoneLoss(group, mid, () => mid);
    // (b) One cone alone (a synthetic group of one), through its centre: 14 + 58 px.
    const cone: Zone = {
      kind: 'cone',
      left: centre - (CONE_WIDTH * SUB) / 2,
      right: centre + (CONE_WIDTH * SUB) / 2,
      rear: U,
      front: U + CONE_LENGTH * SUB,
    };
    const one = zoneLoss([cone], centre, () => centre);
    // (c) A graze: the group's end cone (the innermost, frontmost) touched for
    // one step only — the car steers away from it at 440 units a step and its
    // left edge is 200 units inside the cone's right edge on the one step its
    // front is past the cone's rear.
    const end = group[2]!;
    const lead = 10;
    // Step J is the first whose front passes the end cone's rear (r_j = r_0 + 420 j);
    // the car steers right on steps J − 9 .. J, so its left edge reaches the
    // cone's right edge − 200 units on step J and clears it on step J + 1.
    const r0 = U - 1000 * SUB;
    const J = Math.floor((end.rear - r0) / FULL_SPEED) + 1;
    const steerFrom = r0 + FULL_SPEED * (J - lead);
    const grazeStart = end.right + CAR_HALF_WIDTH - 200 - lead * STEER_PER_STEP;
    const graze = zoneLoss(group, grazeStart, (car) =>
      car.r < steerFrom ? grazeStart : grazeStart + 40 * SUB,
    );
    // (d) Sand 150 and 250, the lane's centre.
    const sand150 = zoneLoss([sandZone(3, lane, 150, U)], centre, () => centre);
    const sand250 = zoneLoss([sandZone(3, lane, 250, U)], centre, () => centre);

    expect(three.coneSteps).toBeGreaterThan(one.coneSteps);
    expect(graze.coneSteps).toBe(1);
    for (const [name, r] of [
      ['3-cone group', three],
      ['one cone', one],
      ['graze', graze],
      ['sand 150', sand150],
      ['sand 250', sand250],
    ] as const) {
      expect(r.bumps, name).toBe(0);
      expect(r.loss, name).toBeGreaterThan(0);
    }
    expect(sand150.sandSteps).toBeGreaterThan(0);
    expect(sand250.loss).toBeGreaterThan(sand150.loss);
    // §4 "損の順序" (2) and (3).
    expect(rushMin).toBeGreaterThanOrEqual(2 * three.loss);
    expect(rushMin).toBeGreaterThan(sand250.loss);
    const line = (r: ZoneRun) => `${r.loss} steps = ${s(r.loss)} s`;
    report('loss: wall slowdown at most', `${leastMax} steps = ${s(leastMax)} s`);
    report('loss: cone graze (1 touching step)', line(graze));
    report('loss: one cone, centre', line(one), `touching steps ${one.coneSteps}`);
    report(
      'loss: 3-cone group, middle cone centre',
      line(three),
      `touching steps ${three.coneSteps}`,
    );
    report('loss: sand 150, lane centre', line(sand150), `steps on sand ${sand150.sandSteps}`);
    report('loss: sand 250, lane centre', line(sand250), `steps on sand ${sand250.sandSteps}`);
    report('loss: Bump at least', `${rushMin} steps = ${s(rushMin)} s`);
    report(
      'loss: Bump / 3-cone group',
      (rushMin / three.loss).toFixed(2),
      'Bump / sand 250',
      (rushMin / sand250.loss).toFixed(2),
    );
  }, 60_000);
});
