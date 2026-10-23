/** Physical, non-predictive driver for pair passage and loss tests (§5). */
import { FULL_SPEED, SUB } from './constants';
import { assembleCourse } from './course';
import { laneCenter } from './geometry';
import { advanceCar, brakeForSpeed, newCar, newReport } from './physics';
import { brakingDistance } from './planner';
import { windowEnd } from './route';
import type { Course, Row } from './types';

export function delayedPairRun(
  course: Course,
  second: Row,
  options: {
    speed?: number;
    reactionSteps?: number;
    firstOffset?: number;
    secondOffset?: number;
    empty?: boolean;
    buttonBrake?: boolean;
  } = {},
) {
  const first = course.rows[second.index - 1]!;
  const pair = assembleCourse(
    course.level,
    course.lanes,
    course.length,
    options.empty ? [] : [first, second],
  );
  const startX = laneCenter(course.lanes, first.gap) + (options.firstOffset ?? 0) * SUB;
  const targetX = laneCenter(course.lanes, second.gap) + (options.secondOffset ?? 0) * SUB;
  const car = { ...newCar(first.u - 1000 * SUB, startX, FULL_SPEED) };
  const speed = options.buttonBrake ? 240 : (options.speed ?? 300);
  const end = windowEnd(first);
  const finish = windowEnd(second) + 1000 * SUB;
  let clearedAt: number | null = null;
  let braking = false;
  let overlaps = 0;
  let scrapes = 0;
  for (let step = 0; step < 20_000; step++) {
    // React only after the whole car is clear. No prediction of future position,
    // edge pre-positioning, noise projection or access to the route planner.
    if (clearedAt === null && car.r >= end) clearedAt = step;
    const steerX =
      clearedAt !== null && step - clearedAt >= (options.reactionSteps ?? 30) ? targetX : startX;
    if (end - car.r <= brakingDistance(car.w, speed) + 4 * car.w) braking = true;
    const brake = options.buttonBrake
      ? braking && clearedAt === null
        ? 1000
        : 0
      : braking && car.r <= second.u
        ? brakeForSpeed(speed)
        : 0;
    const result = advanceCar(pair, car, { steerX, brake }, newReport());
    if (result.overlapped) overlaps += 1;
    if (result.scraped) scrapes += 1;
    if (car.r >= finish) return { steps: step + 1, bumps: car.bumps, overlaps, scrapes };
  }
  throw new Error('delayed pair driver did not finish');
}
