/**
 * The physics of one step and the run's states (docs/BOUNCE_UP_RULES.md §2,
 * §4): the apex, landing only while falling, no tunnelling, the wrap, the
 * camera, `over`, the target model and the state machine.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BOARD_WIDTH,
  BODY_HEIGHT,
  CAMERA_ANCHOR,
  FOOT_HALF,
  GEN_AHEAD,
  GEN_PER_STEP_LIMIT,
  INITIAL_SEGMENTS_LIMIT,
  GAP_APEX_PERCENT,
  GAP_MAX_PX,
  GRAVITY_PER_STEP,
  JUMP_SPEED,
  LEAD_MAX,
  RUN_SPEED,
  START_FLOOR_MARGIN,
  SUB,
} from './constants';
import {
  NO_INPUT,
  airSteps,
  apexUnits,
  createRun,
  overlaps,
  pause,
  resume,
  start,
  step,
} from './physics';
import { board, collectNumbers, plat, px, report } from './test-helpers';
import type { RunState, StepInput } from './types';

function run(s: RunState, n: number, input: StepInput = NO_INPUT): RunState {
  let state = s;
  for (let k = 0; k < n; k++) state = step(state, input);
  return state;
}

describe('the jump (§2)', () => {
  it('gravity is 15 px/s per step and the discrete apex is 18,875 units (157.29 px)', () => {
    expect(GRAVITY_PER_STEP).toBe(15);
    const apex = apexUnits();
    expect(apex).toBe(18_875);
    report('apex (discrete)', `${apex} units`, `${(apex / SUB).toFixed(2)} px`);
    report('apex (continuous v²/2g)', `${((JUMP_SPEED * JUMP_SPEED) / 3600).toFixed(1)} px`);
  });

  it('a run from the floor rises exactly the apex, then lands back on the floor after 101 steps', () => {
    let s = start(createRun('apex', 'normal'));
    // Only the floor under the body: no platform above can catch it.
    s = {
      ...s,
      platforms: s.platforms.filter((p) => p.segment === 0),
      gen: { ...s.gen, chainTop: Number.MAX_SAFE_INTEGER },
    };
    let top = 0;
    let steps = 0;
    do {
      s = step(s);
      steps += 1;
      if (s.y > top) top = s.y;
    } while (s.event !== 'bounce' && steps < 1000);
    expect(top).toBe(apexUnits());
    expect(steps).toBe(101);
    expect(s.y).toBe(0);
    expect(s.vy).toBe(JUMP_SPEED);
    expect(airSteps(0)).toBe(101);
    report('air time back to the same height', `${steps} steps`, `${(steps / 120).toFixed(3)} s`);
  });

  it('the gap cap (128 px) is within 82 % of the apex (§3 invariant 1)', () => {
    const cap = Math.floor((GAP_APEX_PERCENT * apexUnits()) / 100);
    expect(cap).toBe(15_477);
    expect(GAP_MAX_PX.end * SUB).toBeLessThanOrEqual(cap);
    expect(airSteps(GAP_MAX_PX.end * SUB)).toBe(72);
    expect(airSteps(apexUnits() + 1)).toBe(-1);
    report('82 % of the apex', `${cap} units`, `${(cap / SUB).toFixed(2)} px`);
    report('air steps to land 128 px up', airSteps(GAP_MAX_PX.end * SUB));
  });
});

describe('landing (§2 step 5)', () => {
  it('passes up through a platform and lands on it only on the way down', () => {
    // Body on the floor line, a platform 60 px up straight above.
    let s = board([plat(1, 60, 148)], { x: px(180), y: 0, vy: JUMP_SPEED });
    let passedAbove = false;
    let landed = -1;
    for (let k = 1; k <= 200 && landed < 0; k++) {
      s = step(s);
      if (s.y > px(60)) passedAbove = true;
      if (s.event === 'bounce') landed = k;
      if (!passedAbove) expect(s.event).toBe('none');
    }
    expect(passedAbove).toBe(true);
    expect(landed).toBe(airSteps(px(60)));
    expect(s.y).toBe(px(60));
    expect(s.vy).toBe(JUMP_SPEED);
  });

  it('does not land while rising, even when the foot ends a step exactly on a top surface', () => {
    // vy after the first step is 745: the foot goes 0 → 745 units, onto the top.
    const s = board([{ ...plat(1, 0, 148), top: 745 }], { x: px(180), y: 0, vy: JUMP_SPEED });
    const after = step(s);
    expect(after.y).toBe(745);
    expect(after.event).toBe('none');
    expect(after.vy).toBe(745);
  });

  it('never tunnels: falls of 6,000 and 60,000 px/s land on a top every 37 units of the step, and at both ends', () => {
    // §2 step 5: a falling foot lands on a top t with y₀ ≥ t ≥ y₁ (closed at both
    // ends), where y₁ = y₀ − fall − GRAVITY_PER_STEP.
    const y0 = px(1000);
    const landsOn = (fall: number, top: number): RunState =>
      step(board([{ ...plat(1, 0, 148), top }], { x: px(180), y: y0, vy: -fall, cameraBottom: 0 }));
    let checked = 0;
    for (const fall of [6000, 60_000]) {
      const last = fall + GRAVITY_PER_STEP; // offset of y₁ below y₀
      const offsets: number[] = [];
      for (let offset = 0; offset < last; offset += 37) offsets.push(offset);
      offsets.push(last); // top == y₁: the foot ends the step exactly on it
      for (const offset of offsets) {
        // The top sits `offset` units below the foot: it is crossed this step.
        const top = y0 - offset;
        const after = landsOn(fall, top);
        expect(after.event, `fall ${fall} offset ${offset}`).toBe('bounce');
        expect(after.y).toBe(top);
        checked += 1;
      }
      // Just outside either end: one unit below y₁, one unit above y₀.
      expect(landsOn(fall, y0 - last - 1).event, `fall ${fall} below y₁`).toBe('none');
      expect(landsOn(fall, y0 + 1).event, `fall ${fall} above y₀`).toBe('none');
      checked += 2;
    }
    report('no-tunnelling cases checked (incl. 4 just outside)', checked);
  });

  it('lands on the highest of several tops crossed in one step', () => {
    const s = board([plat(1, 900, 148), plat(2, 950, 148), plat(3, 980, 148)], {
      x: px(180),
      y: px(1000),
      vy: -12_000,
      cameraBottom: 0,
    });
    const after = step(s);
    expect(after.y).toBe(px(980));
    expect(after.reachedSegment).toBe(3);
  });

  it('the foot allowance is 10 px either side, and nothing more', () => {
    const left = px(100);
    expect(overlaps(left - FOOT_HALF, left, px(64))).toBe(true);
    expect(overlaps(left - FOOT_HALF - 1, left, px(64))).toBe(false);
    expect(overlaps(left + px(64) + FOOT_HALF, left, px(64))).toBe(true);
    expect(overlaps(left + px(64) + FOOT_HALF + 1, left, px(64))).toBe(false);
  });

  it('a body drawn across the edge lands on a platform at the other edge (wrap)', () => {
    expect(overlaps(px(355), 0, px(64))).toBe(true); // 355 − 360 = −5 ≥ −10
    expect(overlaps(px(5), px(296), px(64))).toBe(true); // 5 + 360 = 365 ≤ 370
    const s = board([plat(1, 100, 0)], { x: px(355), y: px(101), vy: -200, cameraBottom: 0 });
    expect(step(s).event).toBe('bounce');
  });

  it('a vanishing platform carries one bounce and is gone', () => {
    let s = board([plat(1, 100, 148, 64, 'vanishing')], {
      x: px(180),
      y: px(101),
      vy: -200,
      cameraBottom: 0,
    });
    s = step(s);
    expect(s.event).toBe('vanish');
    expect(s.vy).toBe(JUMP_SPEED);
    expect(s.platforms).toHaveLength(0);
    // Back down through where it was: nothing to catch the body.
    for (let k = 0; k < 200; k++) {
      s = step(s);
      expect(s.event === 'bounce' || s.event === 'vanish').toBe(false);
    }
  });

  it('a moving platform is landed on where the triangle wave has it at that tick', () => {
    // Off the wave's midpoint and with a phase, so a wave run backwards or
    // without its phase puts the platform somewhere else.
    const moving = {
      ...plat(1, 100, 0, 64, 'moving'),
      chain: false,
      motion: { lo: 0, span: px(200), speed: 60, phase: px(30) },
    };
    const at = (tick: number, xPx: number): string =>
      step(board([moving], { tick, x: px(xPx), y: px(101), vy: -200, cameraBottom: 0 })).event;
    // Tick 1000, going right: u = (60,000 + 3,600) mod 48,000 = 15,600 ≤ span,
    // so the platform spans 130–194 px. Run backwards it would span 70–134 px;
    // without the phase, 100–164 px.
    expect(at(999, 180)).toBe('bounce');
    expect(at(999, 90)).toBe('none');
    expect(at(999, 250)).toBe('none');
    // Tick 1400, coming back: u = 87,600 mod 48,000 = 39,600 > span, so the
    // left edge is 48,000 − 39,600 = 8,400 units and it spans 70–134 px. Run
    // backwards it would span 130–194 px.
    expect(at(1399, 90)).toBe('bounce');
    expect(at(1399, 180)).toBe('none');
  });
});

describe('sideways: the target model and the wrap (§2 step 3, §4)', () => {
  it('a drag moves the target 1:1 but never more than 48 px ahead; the body chases at 600 px/s', () => {
    let s = board([], { x: px(100), target: px(100), y: px(300), vy: 0, cameraBottom: 0 });
    s = step(s, { drag: px(200), dir: 0 });
    expect(s.target - s.x).toBeLessThanOrEqual(LEAD_MAX);
    expect(s.x).toBe(px(100) + RUN_SPEED);
    // The finger stops: the body comes to rest within the lead.
    const stoppedAt = s.x;
    let steps = 0;
    while (s.x !== s.target && steps < 100) {
      s = step(s);
      steps += 1;
    }
    expect(s.x - stoppedAt).toBeLessThanOrEqual(LEAD_MAX);
    expect(steps).toBeLessThanOrEqual(10); // 48 px at 5 px per step
    report('steps for the body to stop after the finger', steps);
  });

  it('a small drag is followed exactly', () => {
    const s = step(board([], { x: px(100), target: px(100), y: px(300), cameraBottom: 0 }), {
      drag: 250,
      dir: 0,
    });
    expect(s.x).toBe(px(100) + 250);
    expect(s.target).toBe(s.x);
  });

  it('held keys move at full speed; releasing stops the body that step', () => {
    let s = board([], { x: px(100), target: px(100), y: px(300), cameraBottom: 0 });
    s = run(s, 10, { drag: 0, dir: 1 });
    expect(s.x).toBe(px(100) + 10 * RUN_SPEED);
    expect(s.heldDir).toBe(1);
    const at = s.x;
    s = step(s);
    expect(s.x).toBe(at);
    expect(s.target).toBe(at);
    expect(s.heldDir).toBe(0);
  });

  it('a held direction wins over a drag in the same step', () => {
    const s = step(board([], { x: px(100), target: px(100), y: px(300), cameraBottom: 0 }), {
      drag: px(-40),
      dir: 1,
    });
    expect(s.x).toBe(px(100) + RUN_SPEED);
  });

  it('wraps: out at the right edge, in at the left, the target keeping its lead', () => {
    let s = board([], { x: px(358), target: px(358), y: px(300), cameraBottom: 0 });
    s = step(s, { drag: 0, dir: 1 });
    expect(s.x).toBe(px(358) + RUN_SPEED - BOARD_WIDTH);
    expect(s.target - s.x).toBe(LEAD_MAX - RUN_SPEED);
    let t = board([], { x: px(2), target: px(2), y: px(300), cameraBottom: 0 });
    t = step(t, { drag: 0, dir: -1 });
    expect(t.x).toBe(px(2) - RUN_SPEED + BOARD_WIDTH);
    for (const v of [s.x, t.x]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(BOARD_WIDTH);
    }
  });

  it('a drag that keeps going keeps the body going across the edge', () => {
    let s = board([], { x: px(300), target: px(300), y: px(5000), vy: 0, cameraBottom: 0 });
    for (let k = 0; k < 40; k++) s = step(s, { drag: 600, dir: 0 });
    // 40 steps × 5 px = 200 px: 300 → 500 → wraps to 140.
    expect(s.x).toBe(px(140));
  });

  it('bad input reads as none: NaN drag, a direction of 2', () => {
    const s = board([], { x: px(100), target: px(100), y: px(300), cameraBottom: 0 });
    const a = step(s, { drag: Number.NaN, dir: 2 });
    expect(a.x).toBe(px(100));
    expect(a.heldDir).toBe(0);
  });
});

describe('the camera and the end (§2 steps 6–7)', () => {
  it('starts with the floor 96 px above the bottom edge and only ever rises', () => {
    const s0 = createRun('camera', 'normal');
    expect(s0.cameraBottom).toBe(-START_FLOOR_MARGIN);
    let s = start(s0);
    let last = s.cameraBottom;
    for (let k = 0; k < 3000 && s.status === 'running'; k++) {
      s = step(s, { drag: k % 400 < 200 ? 300 : -300, dir: 0 });
      expect(s.cameraBottom).toBeGreaterThanOrEqual(last);
      expect(s.y - s.cameraBottom).toBeLessThanOrEqual(CAMERA_ANCHOR);
      last = s.cameraBottom;
    }
  });

  it('ends once the whole body is below the bottom edge, not before', () => {
    let s = board([], { x: px(180), y: px(500), vy: 0, cameraBottom: px(400) });
    let steps = 0;
    while (s.status === 'running' && steps < 1000) {
      const before = s;
      s = step(s);
      steps += 1;
      if (s.status === 'running') {
        expect(s.y + BODY_HEIGHT).toBeGreaterThan(s.cameraBottom);
      } else {
        expect(before.y + BODY_HEIGHT).toBeGreaterThan(before.cameraBottom);
      }
    }
    expect(s.status).toBe('over');
    expect(s.event).toBe('over');
    expect(s.y + BODY_HEIGHT).toBeLessThanOrEqual(s.cameraBottom);
    expect(step(s)).toBe(s);
  });

  it('the view always shows at least 360 px above the foot', () => {
    expect(640 * SUB - CAMERA_ANCHOR).toBe(px(360));
  });
});

describe('the generation work bound (§3「仕事量」, §11)', () => {
  it('a new run builds its view within the initial bound', () => {
    for (const width of ['normal', 'wide'] as const) {
      const s = createRun('initial', width);
      expect(s.genCapHits).toBe(0);
      expect(s.gen.next - 1).toBeLessThanOrEqual(INITIAL_SEGMENTS_LIMIT);
      expect(s.gen.chainTop).toBeGreaterThanOrEqual(s.cameraBottom + px(640) + GEN_AHEAD);
      report(`segments built by createRun (${width})`, s.gen.next - 1);
    }
  });

  it('a step that would need more than 4 segments adds 4, counts the hit, and catches up next step', () => {
    // A camera pushed far above the tower (not reachable in play): the step
    // must stop at the bound rather than loop.
    const s0 = start(createRun('cap', 'normal'));
    const s = { ...s0, y: px(20_000), vy: 0, cameraBottom: px(19_800) };
    const a = step(s);
    expect(a.generatedLastStep).toBe(GEN_PER_STEP_LIMIT);
    expect(a.genCapHits).toBe(s0.genCapHits + 1);
    expect(a.gen.next).toBe(s0.gen.next + GEN_PER_STEP_LIMIT);
    const b = step(a);
    expect(b.generatedLastStep).toBe(GEN_PER_STEP_LIMIT);
    expect(b.gen.next).toBe(a.gen.next + GEN_PER_STEP_LIMIT);
  });
});

describe('states (§4)', () => {
  it('ready → running only on start; a ready step changes nothing', () => {
    const r = createRun('states', 'normal');
    expect(r.status).toBe('ready');
    expect(step(r, { drag: 999, dir: 1 })).toBe(r);
    expect(pause(r)).toBe(r);
    expect(resume(r)).toBe(r);
    const s = start(r);
    expect(s.status).toBe('running');
    expect(s.vy).toBe(JUMP_SPEED);
    expect(start(s)).toBe(s);
  });

  it('pause drops held input; a paused step changes nothing; resume needs the call', () => {
    let s = start(createRun('pause', 'normal'));
    s = run(s, 5, { drag: 0, dir: 1 });
    s = step(s, { drag: px(30), dir: 0 });
    const p = pause(s);
    expect(p.status).toBe('paused');
    expect(p.target).toBe(p.x);
    expect(p.heldDir).toBe(0);
    expect(pause(p)).toBe(p);
    expect(step(p, { drag: 500, dir: 1 })).toBe(p);
    const r = resume(p);
    expect(r.status).toBe('running');
    expect(resume(r)).toBe(r);
    // Nothing carried over: no input, no sideways motion.
    expect(step(r).x).toBe(r.x);
  });

  it('every number in the state is a safe integer at every step of a 2,000-step run (§2)', () => {
    let s = start(createRun('integers', 'wide'));
    let checked = 0;
    let bad = 0;
    for (let k = 0; k < 2000 && s.status === 'running'; k++) {
      s = step(s, { drag: ((k * 37) % 900) - 450, dir: 0 });
      for (const v of collectNumbers(s)) if (!Number.isSafeInteger(v)) bad += 1;
      checked += 1;
    }
    expect(checked).toBe(2000);
    expect(bad).toBe(0);
  });
});

describe('game/ stays clock-free and integer-safe (§2)', () => {
  it('has no Math.random, Date, performance or transcendental math outside tests', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const sources = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && !f.includes('.test.') && f !== 'test-helpers.ts',
    );
    expect(sources.length).toBeGreaterThanOrEqual(9);
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
