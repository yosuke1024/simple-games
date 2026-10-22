/**
 * The three rivals (docs/OVERTAKE_RULES.md §6): cars at their own pace, driven
 * by `planLane` under a speed cap from the frozen pace table. Nothing here
 * takes the player as an argument — a rival's run is a function of the course
 * and its own state, so every race's rivals replay the same trajectories.
 *
 * `simulateRivals` is "the rivals-only run": no player, no stopping at the
 * player's goal, each rival until its own goal. Rival goal steps are read,
 * pinned and compared there (§6, §16), because a race stops when the player
 * finishes (or a bot gives up) and may never see all three rivals home.
 */
import { DECISION_INTERVAL, MAX_RACE_STEPS, RIVAL_COUNT, RIVAL_STARTS } from './constants';
import { paceCap } from './pace';
import { advanceCar, freeze, newReport, type MutableCar } from './physics';
import { planLane } from './planner';
import { RIVAL_PACE, type PaceRow } from './rivalPace';
import type { CarState, Course, StepInput } from './types';
import { COAST } from './types';
import { clampLevel } from './levels';

export interface MutableRival {
  car: MutableCar;
  decision: StepInput;
  /** Steps run when this rival crossed the line, or null. */
  finish: number | null;
}

export function rivalStart(index: number, speed: number): MutableRival {
  const start = RIVAL_STARTS[index]!;
  return {
    car: {
      r: start.r,
      x: start.x,
      w: speed,
      target: start.x,
      hold: 0,
      lock: 0,
      blink: 0,
      bumps: 0,
      coneCap: 0,
    },
    decision: COAST,
    finish: null,
  };
}

export function paceRow(level: number, table: readonly PaceRow[] = RIVAL_PACE): PaceRow {
  return table[clampLevel(level) - 1]!;
}

/** The planner work of the last decision, for the work counts of §17. */
export interface RivalStepInfo {
  planned: boolean;
  work: number;
  /** Whether the decision made this step found a feasible candidate (§6). */
  feasible: boolean;
  bumped: boolean;
  /** Sand under the car at this step's speed rule (§4) — printed, not gated (§6). */
  onSand: boolean;
  /** The car touched a cone after this step (§4). */
  coneHit: boolean;
}

/**
 * Advances rival `index` (0-based) by one step: `step` is the number of steps
 * the race has run before this one. Decisions are made when step is a
 * multiple of DECISION_INTERVAL and held in between.
 */
export function advanceRival(
  course: Course,
  rival: MutableRival,
  index: number,
  mean: number,
  step: number,
  info?: RivalStepInfo,
): void {
  if (rival.finish !== null) return;
  if (step % DECISION_INTERVAL === 0) {
    const decision = planLane(course, rival.car, paceCap(mean, index + 1, rival.car.r));
    rival.decision = { steerX: decision.steerX, brake: decision.brake };
    if (info !== undefined) {
      info.planned = true;
      info.work = decision.work;
      info.feasible = decision.feasible;
    }
  }
  const report = advanceCar(course, rival.car, rival.decision, newReport());
  if (info !== undefined) {
    info.bumped = report.bumped;
    info.onSand = report.onSand;
    info.coneHit = report.coneHit;
  }
  if (rival.car.r >= course.length) rival.finish = step + 1;
}

export interface RivalsRun {
  /** Goal step per rival (null when MAX_RACE_STEPS ran out). */
  readonly finish: readonly (number | null)[];
  readonly bumps: readonly number[];
  /** Every state after every step, per rival, when asked for (tests). */
  readonly trace?: readonly (readonly CarState[])[];
  /** Largest planner work of one decision (§17). */
  readonly maxWork: number;
  readonly decisions: number;
  /** Decisions with no feasible candidate (§6). */
  readonly infeasible: number;
  /** Steps a rival spent with sand under it, all rivals (§6: printed, not gated). */
  readonly sandSteps: number;
  /** Cone touches — runs of touching steps — all rivals (§6: printed, not gated). */
  readonly coneTouches: number;
}

export interface SimulateOptions {
  readonly trace?: boolean;
  readonly maxSteps?: number;
  /** Override one rival's mean (calibration); others come from the table. */
  readonly means?: readonly number[];
  /** Run only these rivals (0-based); the rest are skipped. */
  readonly only?: readonly number[];
}

export function simulateRivals(
  course: Course,
  level: number,
  table: readonly PaceRow[] = RIVAL_PACE,
  options: SimulateOptions = {},
): RivalsRun {
  const means = options.means ?? paceRow(level, table);
  const maxSteps = options.maxSteps ?? MAX_RACE_STEPS;
  const finish: (number | null)[] = [];
  const bumps: number[] = [];
  const trace: CarState[][] = [];
  let maxWork = 0;
  let decisions = 0;
  let infeasible = 0;
  let sandSteps = 0;
  let coneTouches = 0;
  for (let i = 0; i < RIVAL_COUNT; i++) {
    if (options.only !== undefined && !options.only.includes(i)) {
      finish.push(null);
      bumps.push(0);
      trace.push([]);
      continue;
    }
    const rival = rivalStart(i, 240);
    const states: CarState[] = [];
    const info: RivalStepInfo = {
      planned: false,
      work: 0,
      feasible: true,
      bumped: false,
      onSand: false,
      coneHit: false,
    };
    let touching = false;
    for (let step = 0; step < maxSteps && rival.finish === null; step++) {
      info.planned = false;
      advanceRival(course, rival, i, means[i]!, step, info);
      if (info.onSand) sandSteps += 1;
      if (info.coneHit && !touching) coneTouches += 1;
      touching = info.coneHit;
      if (info.planned) {
        decisions += 1;
        if (info.work > maxWork) maxWork = info.work;
        if (!info.feasible) infeasible += 1;
      }
      if (options.trace === true) states.push(freeze(rival.car));
    }
    finish.push(rival.finish);
    bumps.push(rival.car.bumps);
    trace.push(states);
  }
  const counts = { maxWork, decisions, infeasible, sandSteps, coneTouches };
  return options.trace === true
    ? { finish, bumps, trace, ...counts }
    : { finish, bumps, ...counts };
}
