/**
 * Reference bots (docs/OVERTAKE_RULES.md §6 "参照ボット"): tests and the pace
 * calibration only — the app never runs them (nothing under ui/ imports this
 * file). Every bot is deterministic in (course, its parameters), decides at
 * 30 Hz like the rivals, and is bounded by MAX_RACE_STEPS.
 *
 * | bot     | steering                                  | speed                  |
 * | ------- | ----------------------------------------- | ---------------------- |
 * | A       | planLane, no delay                        | planLane (cap 420)     |
 * | B       | planLane with reaction delay, noise, view | planLane (cap 420)     |
 * | Rusher  | planLane                                  | always full (brake 0)  |
 * | Crawler | planLane                                  | always hardest (1000)  |
 * | Idler   | none (keeps the start x)                  | always full            |
 */
import {
  DECISION_INTERVAL,
  FULL_SPEED,
  MAX_RACE_STEPS,
  PLAYER_START,
  ROLLING_START_SPEED,
  SUB,
  CAR_LENGTH,
} from './constants';
import { exactDiv } from './arith';
import { advanceCar, freeze, newReport, type MutableCar } from './physics';
import { planLane } from './planner';
import { createRng, randInt, type Rng } from './rng';
import type { CarState, Course, StepInput } from './types';
import { COAST } from './types';

export type BotKind = 'A' | 'B' | 'rusher' | 'crawler' | 'idler';

/** The B family (§6): reaction delay in steps, lateral noise in px, view in seconds × 10. */
export interface SkillParams {
  readonly delaySteps: number;
  readonly noisePx: number;
  /** View distance in px: full speed × the view's seconds. */
  readonly viewPx: number;
  readonly seed: string;
}

export const SKILL_TIERS = {
  /** 150 ms, ±6 px, 0.9 s. */
  advanced: { delaySteps: 18, noisePx: 6, viewPx: exactDiv(FULL_SPEED * 9, 10) },
  /** 250 ms, ±6 px, 0.9 s — B_ref, the calibration bot. */
  intermediate: { delaySteps: 30, noisePx: 6, viewPx: exactDiv(FULL_SPEED * 9, 10) },
  /** 400 ms, ±12 px, 0.7 s. */
  novice: { delaySteps: 48, noisePx: 12, viewPx: exactDiv(FULL_SPEED * 7, 10) },
} as const;
export type SkillTier = keyof typeof SKILL_TIERS;

export const CALIBRATION_SEED = 'overtake-calibrate';

export function skill(tier: SkillTier, seed: string): SkillParams {
  return { ...SKILL_TIERS[tier], seed };
}

/** A bot's input source: called once per step, before the step runs. */
export interface Controller {
  next(step: number, car: MutableCar): StepInput;
  /** Largest planner work of one decision so far (§17). */
  readonly maxWork: number;
  /** Decisions so far for which planLane found no feasible candidate (§6). */
  readonly infeasible: number;
}

class PlannerController implements Controller {
  private decision: StepInput = COAST;
  maxWork = 0;
  infeasible = 0;
  constructor(
    private readonly course: Course,
    private readonly mode: 'A' | 'rusher' | 'crawler',
  ) {}
  next(step: number, car: MutableCar): StepInput {
    if (step % DECISION_INTERVAL === 0) {
      const d = planLane(this.course, car, FULL_SPEED);
      if (d.work > this.maxWork) this.maxWork = d.work;
      if (!d.feasible) this.infeasible += 1;
      const brake = this.mode === 'A' ? d.brake : this.mode === 'rusher' ? 0 : 1000;
      this.decision = { steerX: d.steerX, brake };
    }
    return this.decision;
  }
}

/**
 * Bot B (§6): decisions every DECISION_INTERVAL steps take effect `delay`
 * steps later. A decision plans from where the car will be when it takes
 * effect — the bot knows its own pending inputs and the traffic does not
 * move, so that prediction is exact (it is kept one step ahead of the real
 * car rather than re-simulated per decision) — while its view is still
 * measured from where the car is now: the delay costs look-ahead. Noise
 * shifts each decision's goal by a uniform integer within ±noise px before
 * the planner projects it onto the positions that still finish the view.
 */
export class SkillController implements Controller {
  private readonly queue: { at: number; input: StepInput }[] = [];
  private current: StepInput = COAST;
  private ahead: StepInput = COAST;
  private readonly rng: Rng;
  private predicted: MutableCar | null = null;
  maxWork = 0;
  infeasible = 0;
  constructor(
    private readonly course: Course,
    private readonly params: SkillParams,
    level: number,
  ) {
    this.rng = createRng(`${params.seed}:${level}`);
  }
  next(step: number, car: MutableCar): StepInput {
    const delay = this.params.delaySteps;
    if (this.predicted === null) {
      // Before the first decision lands, the car coasts (§6).
      this.predicted = { ...car };
      for (let s = 0; s < delay; s++) advanceCar(this.course, this.predicted, COAST, newReport());
    }
    const predicted = this.predicted;
    if (step % DECISION_INTERVAL === 0) {
      const seen = this.params.viewPx * SUB - (predicted.r - car.r);
      const amplitude = this.params.noisePx * SUB;
      const offset = randInt(this.rng, 2 * amplitude + 1) - amplitude;
      const d = planLane(this.course, predicted, FULL_SPEED, {
        view: Math.max(CAR_LENGTH, seen),
        aimOffset: offset,
      });
      if (d.work > this.maxWork) this.maxWork = d.work;
      if (!d.feasible) this.infeasible += 1;
      const input = { steerX: d.steerX, brake: d.brake };
      this.queue.push({ at: step + delay, input });
    }
    // Keep the prediction `delay` steps ahead: it now takes the input due then.
    for (const q of this.queue) if (q.at === step + delay) this.ahead = q.input;
    while (this.queue.length > 0 && this.queue[0]!.at <= step) {
      this.current = this.queue.shift()!.input;
    }
    advanceCar(this.course, predicted, delay === 0 ? this.current : this.ahead, newReport());
    return this.current;
  }
  /**
   * Tests only: the predicted car after the last `next(step)` — where the real
   * car will be once step + delay has run (game/bots.test.ts checks it is exact).
   */
  prediction(): CarState | null {
    return this.predicted === null ? null : freeze(this.predicted);
  }
}

class IdleController implements Controller {
  readonly maxWork = 0;
  readonly infeasible = 0;
  next(): StepInput {
    return COAST;
  }
}

export function controllerFor(course: Course, kind: BotKind, params?: SkillParams): Controller {
  switch (kind) {
    case 'A':
    case 'rusher':
    case 'crawler':
      return new PlannerController(course, kind);
    case 'B':
      return new SkillController(
        course,
        params ?? skill('intermediate', CALIBRATION_SEED),
        course.level,
      );
    case 'idler':
      return new IdleController();
  }
}

export interface BotRun {
  /**
   * finished: crossed the line. decided: stopped once the fastest rival was
   * home first (no win possible). unfinished: MAX_RACE_STEPS ran out.
   */
  readonly status: 'finished' | 'decided' | 'unfinished';
  readonly finishStep: number | null;
  readonly steps: number;
  readonly bumps: number;
  /** Most resolution passes in one step (§4, §17). */
  readonly maxPasses: number;
  readonly maxWork: number;
  /** Planner decisions with no feasible candidate (§6). */
  readonly infeasible: number;
  /** Steps with sand under the car (§4) — printed, not gated. */
  readonly sandSteps: number;
  /** Cone touches — runs of touching steps (§4) — printed, not gated. */
  readonly coneTouches: number;
}

export interface RunOptions {
  /** Stop once this step has run without finishing (the fastest rival's goal). */
  readonly stopAfter?: number;
  readonly maxSteps?: number;
  /** Called after every step (golden input sequences). */
  readonly onStep?: (step: number, car: MutableCar, input: StepInput) => void;
}

/**
 * Runs a bot alone from the player's grid slot. Rivals never interact with
 * the player (§4, §6), so their goal steps come from `simulateRivals`; the
 * race's outcome is then `placeFor(finishStep, rivalFinish)`.
 */
export function runBot(course: Course, controller: Controller, options: RunOptions = {}): BotRun {
  const car: MutableCar = {
    r: PLAYER_START.r,
    x: PLAYER_START.x,
    w: ROLLING_START_SPEED,
    target: PLAYER_START.x,
    hold: 0,
    lock: 0,
    blink: 0,
    bumps: 0,
    coneCap: 0,
  };
  const maxSteps = options.maxSteps ?? MAX_RACE_STEPS;
  const stopAfter = options.stopAfter ?? Infinity;
  const report = newReport();
  let maxPasses = 0;
  let sandSteps = 0;
  let coneTouches = 0;
  let touching = false;
  const tally = () => ({
    bumps: car.bumps,
    maxPasses,
    maxWork: controller.maxWork,
    infeasible: controller.infeasible,
    sandSteps,
    coneTouches,
  });
  for (let step = 0; step < maxSteps; step++) {
    const input = controller.next(step, car);
    report.passes = 0;
    advanceCar(course, car, input, report);
    if (report.passes > maxPasses) maxPasses = report.passes;
    if (report.onSand) sandSteps += 1;
    if (report.coneHit && !touching) coneTouches += 1;
    touching = report.coneHit;
    options.onStep?.(step + 1, car, input);
    if (car.r >= course.length) {
      return { status: 'finished', finishStep: step + 1, steps: step + 1, ...tally() };
    }
    if (step + 1 >= stopAfter) {
      return { status: 'decided', finishStep: null, steps: step + 1, ...tally() };
    }
  }
  return { status: 'unfinished', finishStep: null, steps: maxSteps, ...tally() };
}

/** 1 + rivals home strictly before the player; the same step goes to the player (§2). */
export function placeFor(finishStep: number, rivalFinish: readonly (number | null)[]): number {
  let ahead = 0;
  for (const f of rivalFinish) if (f !== null && f < finishStep) ahead += 1;
  return 1 + ahead;
}

/** The earliest rival goal step, or null when none finished. */
export function fastestRival(rivalFinish: readonly (number | null)[]): number | null {
  let best: number | null = null;
  for (const f of rivalFinish) if (f !== null && (best === null || f < best)) best = f;
  return best;
}

/** Does this bot take first place on this course against these rival goals? */
export function botWins(
  course: Course,
  kind: BotKind,
  rivalFinish: readonly (number | null)[],
  params?: SkillParams,
): { won: boolean; run: BotRun } {
  const fastest = fastestRival(rivalFinish);
  const run = runBot(course, controllerFor(course, kind, params), {
    stopAfter: fastest === null ? undefined : fastest,
  });
  const won = run.status === 'finished' && placeFor(run.finishStep!, rivalFinish) === 1;
  return { won, run };
}
