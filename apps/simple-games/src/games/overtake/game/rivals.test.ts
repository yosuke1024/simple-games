// @vitest-environment node
/**
 * The rivals (docs/OVERTAKE_RULES.md §6): never a Bump, the frozen pace's
 * time ratios, the ±6 % triangle, and no rubber-banding — the rivals in a real
 * race replay the rivals-only run step for step whatever the player does.
 */
import { describe, expect, it } from 'vitest';
import { FULL_SPEED, MIN_TARGET_SPEED, RIVAL_TIME_RATIOS, SUB } from './constants';
import { controllerFor, type Controller } from './bots';
import { generateCourse } from './course';
import { paceCap } from './pace';
import { toMutable } from './physics';
import { createRace, startRace, stepRace, type RaceState } from './race';
import { simulateRivals, type RivalsRun } from './rivals';
import { RIVAL_PACE } from './rivalPace';
import { createRng, randInt } from './rng';
import { LEVELS, collectNumbers, report } from './test-helpers';
import type { Course, StepInput } from './types';
import { COAST } from './types';

const runs = new Map<number, { course: Course; run: RivalsRun }>();
function rivals(level: number) {
  let r = runs.get(level);
  if (r === undefined) {
    const course = generateCourse(level);
    r = { course, run: simulateRivals(course, level) };
    runs.set(level, r);
  }
  return r;
}

describe('pace cap (§6 "ペース")', () => {
  it('stays within c − ceil(6c / 100) .. c + floor(6c / 100), including the negative start position', () => {
    // floor toward −∞ puts the trough at c − ceil(0.06 c): below 0.94 c by
    // less than 1 px/s whenever 0.06 c is not whole (§6).
    const means = new Set<number>([60, 137, 250, 333, 401, 420]);
    for (const row of RIVAL_PACE) for (const c of row) means.add(c);
    let below = 0;
    let worst = 0;
    // Collected and asserted once: ~360,000 samples, too many for one expect each.
    const outside: string[] = [];
    for (const mean of means) {
      const lo = Math.max(MIN_TARGET_SPEED, mean - Math.ceil((6 * mean) / 100));
      const hi = Math.min(FULL_SPEED, mean + Math.floor((6 * mean) / 100));
      for (let rival = 1; rival <= 3; rival++) {
        for (let px = -90; px <= 8200; px += 7) {
          const cap = paceCap(mean, rival, px * SUB);
          if (!Number.isInteger(cap) || cap > hi || cap < lo) {
            outside.push(`c ${mean} rival ${rival} px ${px}: ${cap}`);
          }
          if (cap * 100 < mean * 94) {
            below += 1;
            worst = Math.max(worst, (mean * 94 - cap * 100) / 100);
          }
        }
      }
      // The bounds are reached: the trough at q = P / 2, the crest at q = 0.
      expect(paceCap(mean, 1, 2000 * SUB), `c ${mean}`).toBe(lo);
      expect(paceCap(mean, 1, 0), `c ${mean}`).toBe(hi);
    }
    expect(outside).toEqual([]);
    expect(worst).toBeLessThan(1);
    report(
      'pace cap: means checked',
      means.size,
      'samples below 0.94 c',
      below,
      'at most px/s below',
      worst.toFixed(2),
    );
  });

  it('is the integer triangle of §6 (pinned points, period 4,000 px, phase 1,333 px)', () => {
    const at = (rival: number, px: number) => paceCap(300, rival, px * SUB);
    expect([at(1, 0), at(1, 1000), at(1, 2000), at(1, 3000), at(1, 4000)]).toEqual([
      318, 300, 282, 300, 318,
    ]);
    expect(at(1, -90)).toBe(paceCap(300, 1, 3910 * SUB));
    expect(at(2, 0)).toBe(at(1, 1333));
    expect(at(3, 0)).toBe(at(1, 2666));
    // Sub-pixel positions floor toward −∞, so −1 unit is px −1.
    expect(paceCap(300, 1, -1)).toBe(at(1, -1));
  });
});

describe('the rivals-only run on all 100 levels', () => {
  it('never bumps, never runs out of feasible candidates, finishes in order, and keeps T₂/T₁ and T₃/T₁ within 1 % of 1.04 / 1.09', () => {
    const started = performance.now();
    let r2min = Infinity;
    let r2max = 0;
    let r3min = Infinity;
    let r3max = 0;
    let maxWork = 0;
    let decisions = 0;
    let slowest = 0;
    let sandSteps = 0;
    let coneTouches = 0;
    for (const l of LEVELS) {
      const { run } = rivals(l);
      // Printed, not gated: driving through is the rule when no free lane can
      // be reached (§6 "砂とコーン").
      sandSteps += run.sandSteps;
      coneTouches += run.coneTouches;
      expect(run.bumps, `Lv${l}`).toEqual([0, 0, 0]);
      expect(run.infeasible, `Lv${l}`).toBe(0);
      const [t1, t2, t3] = run.finish as number[];
      expect(t1! < t2! && t2! < t3!, `Lv${l}`).toBe(true);
      const q2 = (t2! * 1000) / t1!;
      const q3 = (t3! * 1000) / t1!;
      expect(Math.abs(q2 - RIVAL_TIME_RATIOS[1]), `Lv${l}`).toBeLessThanOrEqual(
        RIVAL_TIME_RATIOS[1] / 100,
      );
      expect(Math.abs(q3 - RIVAL_TIME_RATIOS[2]), `Lv${l}`).toBeLessThanOrEqual(
        RIVAL_TIME_RATIOS[2] / 100,
      );
      r2min = Math.min(r2min, q2);
      r2max = Math.max(r2max, q2);
      r3min = Math.min(r3min, q3);
      r3max = Math.max(r3max, q3);
      maxWork = Math.max(maxWork, run.maxWork);
      decisions += run.decisions;
      slowest = Math.max(slowest, t3!);
    }
    report(
      'T2/T1 ‰ range',
      r2min.toFixed(1),
      r2max.toFixed(1),
      'T3/T1 ‰ range',
      r3min.toFixed(1),
      r3max.toFixed(1),
    );
    report(
      'rival planLane: decisions',
      decisions,
      'infeasible',
      0,
      'max work of one decision',
      maxWork,
    );
    report('slowest rival goal, steps', slowest);
    report('rivals (300 runs): steps on sand', sandSteps, 'cone touches', coneTouches);
    report(
      'rivals-only runs, ms per level (3 rivals, dev machine)',
      ((performance.now() - started) / 100).toFixed(1),
    );
  }, 60_000);
});

type Style = 'none' | 'A' | 'rusher' | 'crawler' | 'wander';
const STYLES: Style[] = ['none', 'A', 'rusher', 'crawler', 'wander'];

/** Runs a real race with the player driven by `style`, until every rival is home or the player is. */
function race(
  course: Course,
  level: number,
  style: Style,
): { state: RaceState; trace: RaceState[] } {
  let state = startRace(createRace(level));
  const bot: Controller | null =
    style === 'A' || style === 'rusher' || style === 'crawler'
      ? controllerFor(course, style)
      : null;
  const rng = createRng(`wander:${level}`);
  const trace: RaceState[] = [];
  while (state.status === 'running' && state.rivals.some((r) => r.finish === null)) {
    let input: StepInput = COAST;
    if (bot !== null) input = bot.next(state.step, toMutable(state.player));
    else if (style === 'wander' && state.step % 30 === 0) {
      input = { steerX: (40 + randInt(rng, 280)) * SUB, brake: randInt(rng, 1001) };
    } else if (style === 'wander') input = { steerX: null, brake: 0 };
    state = stepRace(course, state, input);
    trace.push(state);
  }
  return { state, trace };
}

describe('no rubber-banding (§6)', () => {
  it('rivals replay the rivals-only run step for step, whatever the player does', () => {
    // Every level with one style (rotating), plus all five styles on ten levels.
    const cases: Array<[number, Style]> = LEVELS.map((l) => [l, STYLES[l % STYLES.length]!]);
    for (const l of [3, 14, 25, 36, 47, 58, 69, 80, 91, 100]) {
      for (const s of STYLES) cases.push([l, s]);
    }
    const solos = new Map<number, RivalsRun>();
    let compared = 0;
    let mismatches = 0;
    const firstMismatch: string[] = [];
    for (const [level, style] of cases) {
      const { course, run } = rivals(level);
      let solo = solos.get(level);
      if (solo === undefined) {
        solo = simulateRivals(course, level, undefined, { trace: true });
        solos.set(level, solo);
      }
      const { trace } = race(course, level, style);
      for (let i = 0; i < 3; i++) {
        const alone = solo.trace![i]!;
        for (let s = 0; s < trace.length && s < alone.length; s++) {
          const a = trace[s]!.rivals[i]!.car;
          const b = alone[s]!;
          compared += 1;
          if (
            a.r !== b.r ||
            a.x !== b.x ||
            a.w !== b.w ||
            a.target !== b.target ||
            a.hold !== b.hold ||
            a.lock !== b.lock ||
            a.blink !== b.blink ||
            a.bumps !== b.bumps
          ) {
            mismatches += 1;
            if (firstMismatch.length === 0)
              firstMismatch.push(`Lv${level} ${style} rival ${i + 1} step ${s + 1}`);
          }
        }
        const last = trace[trace.length - 1]!;
        if (last.rivals[i]!.finish !== null) expect(last.rivals[i]!.finish).toBe(run.finish[i]);
      }
    }
    expect(firstMismatch).toEqual([]);
    expect(mismatches).toBe(0);
    report('no-rubber-band: races', cases.length, 'rival states compared', compared);
  }, 60_000);

  it('race states hold only integers (§1)', () => {
    const { course } = rivals(33);
    const { trace } = race(course, 33, 'wander');
    for (const state of trace.filter((_, i) => i % 97 === 0)) {
      for (const n of collectNumbers(state)) expect(Number.isInteger(n)).toBe(true);
    }
  });
});
