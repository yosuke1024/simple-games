// @vitest-environment node
/**
 * The bot gates (docs/OVERTAKE_RULES.md §6 "参照ボット", §16): A wins every
 * level without a Bump; Rusher (never slows) is diagnostic after the human
 * spacing change; Crawler and Idler never
 * win (smoke tests of the bot plumbing). Rival goals come from the
 * rivals-only run; a bot race stops once the fastest rival is home first.
 * Also: how close the calibration bot B_ref is to A (what T_1 is measured
 * from, §6), and the B family's delay rule and exact self-prediction.
 */
import { describe, expect, it } from 'vitest';
import {
  DECISION_INTERVAL,
  MAX_RACE_STEPS,
  PLAYER_START,
  ROLLING_START_SPEED,
  STEPS_PER_SECOND,
} from './constants';
import {
  SkillController,
  botWins,
  controllerFor,
  fastestRival,
  placeFor,
  runBot,
  skill,
} from './bots';
import { referenceSteps } from './calibrate';
import { generateCourse } from './course';
import { levelSpec } from './levels';
import { advanceCar, freeze, newReport, type MutableCar } from './physics';
import { simulateRivals } from './rivals';
import { LEVELS, report } from './test-helpers';
import type { CarState, Course, StepInput } from './types';

const cache = new Map<number, { course: Course; finish: readonly (number | null)[] }>();
function level(l: number) {
  let v = cache.get(l);
  if (v === undefined) {
    const course = generateCourse(l);
    v = { course, finish: simulateRivals(course, l).finish };
    cache.set(l, v);
  }
  return v;
}

describe('places (§2)', () => {
  it('counts rivals home strictly earlier; the same step goes to the player', () => {
    expect(placeFor(100, [120, 130, 140])).toBe(1);
    expect(placeFor(120, [120, 130, 140])).toBe(1);
    expect(placeFor(121, [120, 130, 140])).toBe(2);
    expect(placeFor(500, [120, 130, 140])).toBe(4);
    expect(placeFor(500, [120, null, null])).toBe(2);
    expect(fastestRival([300, 200, null])).toBe(200);
  });
});

describe('bot gates on all 100 levels', () => {
  it('A wins every level, first, with no Bump and never without a feasible candidate', () => {
    const started = performance.now();
    let tightest = Infinity;
    let tightestLevel = 0;
    let maxWork = 0;
    let maxPasses = 0;
    let decisions = 0;
    let sandSteps = 0;
    let coneTouches = 0;
    for (const l of LEVELS) {
      const { course, finish } = level(l);
      const { won, run } = botWins(course, 'A', finish);
      sandSteps += run.sandSteps;
      coneTouches += run.coneTouches;
      expect(won, `Lv${l}`).toBe(true);
      expect(run.bumps, `Lv${l}`).toBe(0);
      expect(run.infeasible, `Lv${l}`).toBe(0);
      decisions += Math.ceil(run.steps / DECISION_INTERVAL);
      const lead = (fastestRival(finish)! - run.finishStep!) / fastestRival(finish)!;
      if (lead < tightest) {
        tightest = lead;
        tightestLevel = l;
      }
      maxWork = Math.max(maxWork, run.maxWork);
      maxPasses = Math.max(maxPasses, run.maxPasses);
    }
    report(
      'A: smallest lead over rival 1',
      `${(tightest * 100).toFixed(1)} % (Lv${tightestLevel})`,
    );
    report('A: max planLane work of one decision', maxWork, 'max resolution passes', maxPasses);
    report('A: planLane decisions over 100 races', decisions, 'infeasible', 0);
    report('A (100 races, printed only): steps on sand', sandSteps, 'cone touches', coneTouches);
    report(
      'A: ms per race incl. rivals-only run (dev machine)',
      ((performance.now() - started) / 100).toFixed(1),
    );
  }, 60_000);

  it('reports full-throttle bot results without making perfect-bot failure a difficulty requirement', () => {
    const wins: number[] = [];
    for (const l of LEVELS) {
      const { course, finish } = level(l);
      const full = runBot(course, controllerFor(course, 'rusher'));
      expect(full.status, `Lv${l}`).toBe('finished');
      if (full.finishStep! < fastestRival(finish)!) wins.push(l);
    }
    report('Rusher wins with human-spaced pairs (diagnostic only)', wins.join(','));
  }, 60_000);

  it('smoke: Crawler (always the hardest brake) and Idler (no steering) never win', () => {
    for (const l of LEVELS) {
      const { course, finish } = level(l);
      expect(botWins(course, 'crawler', finish).won, `Lv${l} crawler`).toBe(false);
      const idler = botWins(course, 'idler', finish);
      expect(idler.won, `Lv${l} idler`).toBe(false);
      expect(idler.run.status).toBe('decided');
    }
  }, 60_000);

  it('(d) Idler alone (rivals as ghosts) hits MAX_RACE_STEPS and reports "unfinished"', () => {
    const { course } = level(1);
    const run = runBot(course, controllerFor(course, 'idler'));
    expect(run.status).toBe('unfinished');
    expect(run.finishStep).toBeNull();
    expect(run.steps).toBe(MAX_RACE_STEPS);
    report(
      'Idler alone on Lv1: bumps before the bound',
      run.bumps,
      `(${MAX_RACE_STEPS / STEPS_PER_SECOND} s)`,
    );
  });
});

describe('what T_1 is measured from (§6 "目標のタイム")', () => {
  it('B_ref (the calibration bot) finishes within 2.5 % of A on every level', () => {
    // B_ref plans from an exact prediction of where its delayed input lands,
    // so the 250 ms delay costs it almost nothing: T_1 = ceil(S_B × (1 + s))
    // is a margin over near-perfect play, not over a 250 ms player.
    let worst = -Infinity;
    let worstLevel = 0;
    let best = Infinity;
    let lateMin = Infinity;
    let lateMinLevel = 0;
    let lateMax = 0;
    for (const l of LEVELS) {
      const { course, finish } = level(l);
      const a = runBot(course, controllerFor(course, 'A')).finishStep!;
      const sB = referenceSteps(course)!;
      const gap = (sB - a) / a;
      if (gap > worst) {
        worst = gap;
        worstLevel = l;
      }
      best = Math.min(best, gap);
      // T_1 over A: how far behind a perfect, zero-reaction run first place still is.
      const over = (fastestRival(finish)! - a) / a;
      if (l >= 81) {
        if (over < lateMin) {
          lateMin = over;
          lateMinLevel = l;
        }
        lateMax = Math.max(lateMax, over);
      }
      expect(levelSpec(l).slack).toBeGreaterThan(0);
    }
    expect(worst).toBeLessThanOrEqual(0.025);
    report(
      'B_ref vs A: (S_B − A) / A',
      `max ${(worst * 100).toFixed(2)} % (Lv${worstLevel})`,
      `min ${(best * 100).toFixed(2)} %`,
    );
    report(
      'fastest rival vs A on Lv81–100: (rival 1 − A) / A',
      `min ${(lateMin * 100).toFixed(1)} % (Lv${lateMinLevel})`,
      `max ${(lateMax * 100).toFixed(1)} %`,
    );
  }, 60_000);
});

describe('the B family (§6 "反応の遅れ")', () => {
  it('coasts until the first decision lands, then applies the newest decision at least `delay` old', () => {
    const course = generateCourse(23);
    for (const tier of ['advanced', 'intermediate', 'novice'] as const) {
      const params = skill(tier, 'overtake-delay');
      const delay = params.delaySteps;
      const inputs: StepInput[] = [];
      runBot(course, controllerFor(course, 'B', params), {
        maxSteps: 400,
        onStep: (_s, _car, input) => inputs.push(input),
      });
      for (let t = 0; t < delay; t++)
        expect(inputs[t], `${tier} step ${t}`).toEqual({
          steerX: null,
          brake: 0,
        });
      // From `delay` on, the input changes only on steps t with t − delay a decision step.
      for (let t = delay + 1; t < inputs.length; t++) {
        if (inputs[t] !== inputs[t - 1]) {
          expect((t - delay) % DECISION_INTERVAL, `${tier} step ${t}`).toBe(0);
        }
      }
      expect(inputs[delay]).not.toEqual({ steerX: null, brake: 0 });
    }
  }, 60_000);

  it('predicts its own car exactly: the prediction after step s is the real car after s + delay + 1 steps', () => {
    let compared = 0;
    for (const l of [7, 23, 58, 96]) {
      const course = generateCourse(l);
      for (const tier of ['advanced', 'intermediate', 'novice'] as const) {
        const params = skill(tier, 'overtake-predict');
        const controller = controllerFor(course, 'B', params) as SkillController;
        expect(controller).toBeInstanceOf(SkillController);
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
        const predicted: CarState[] = [];
        const real: CarState[] = [freeze(car)];
        for (let step = 0; step < 1500; step++) {
          const input = controller.next(step, car);
          predicted.push(controller.prediction()!);
          advanceCar(course, car, input, newReport());
          real.push(freeze(car));
        }
        const delay = params.delaySteps;
        let mismatches = 0;
        for (let s = 0; s + delay + 1 < real.length; s++) {
          compared += 1;
          if (JSON.stringify(predicted[s]) !== JSON.stringify(real[s + delay + 1])) mismatches += 1;
        }
        expect(mismatches, `Lv${l} ${tier}`).toBe(0);
      }
    }
    report('B family self-prediction: states compared', compared, 'mismatches', 0);
  }, 60_000);
});
