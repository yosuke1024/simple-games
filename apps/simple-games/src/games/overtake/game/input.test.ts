// @vitest-environment node
/**
 * The input mapping (docs/OVERTAKE_RULES.md §3, provisional until Phase 0):
 * the numbers the prototype was built around, reproduced on the pure
 * functions. None of this says anything about how it feels on a device.
 */
import { describe, expect, it } from 'vitest';
import { DRAG_MAPPING } from './constants';
import {
  INPUT_TUNING,
  TARGET_MAX_PX,
  TARGET_MIN_PX,
  beginDrag,
  clickTarget,
  combineBrake,
  dragSteers,
  dragTarget,
  heldTarget,
  moveDrag,
  pullBrake,
  quickRulesVariant,
  ratchetBase,
  reanchor,
  toStepInput,
} from './input';

describe('to the physics: integers only (§1)', () => {
  it('rounds steerX to 1/120 px and floors the brake to 0..1000', () => {
    expect(toStepInput(152.004, 499.9)).toEqual({ steerX: 18240, brake: 499 });
    expect(toStepInput(100.0042, 1200)).toEqual({ steerX: 12001, brake: 1000 });
    expect(toStepInput(null, -4)).toEqual({ steerX: null, brake: 0 });
  });

  it('fails closed: nothing non-finite reaches the physics', () => {
    // A board not laid out yet has scale 0: 0 / 0 must not become NaN.
    const d = beginDrag(1, 100, 0, 150);
    const still = dragTarget(d, 100, 0);
    expect(still).toEqual({ targetX: 150, state: d });
    expect(dragTarget(d, 120, Number.NaN).state).toBe(d);
    expect(dragTarget(d, Number.NaN, 0.56).state).toBe(d);
    expect(dragTarget(d, 120, -1).state).toBe(d);
    expect(dragTarget(d, 120, Infinity).state).toBe(d);
    const moved = moveDrag(d, 100, 40, 0.1, 0, 'A');
    expect(moved).toEqual({ targetX: 150, brake: 0, state: d });
    expect(moveDrag(d, 100, Number.NaN, 0.1, 0.56, 'A').state).toBe(d);
    // The drag keeps working once the scale is usable.
    expect(dragTarget(still.state, 110, 1).targetX).toBeCloseTo(162, 9);
    // The last gate: a non-finite target keeps the current one, a non-finite brake is 0.
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(toStepInput(bad, bad)).toEqual({ steerX: null, brake: 0 });
    }
    expect(combineBrake({ drag: Number.NaN })).toBe(0);
    expect(pullBrake(Number.NaN)).toBe(0);
    expect(heldTarget(150, Number.NaN, 0.1)).toBe(150);
    expect(heldTarget(150, 1, Number.NaN)).toBe(150);
    expect(ratchetBase(10, 30, Number.NaN)).toBe(10);
  });
});

describe('lateral drag (§3 "横")', () => {
  it('moves the car gain × the finger on screen: +100 CSS px → +120 on screen', () => {
    const scale = 0.56;
    const d = beginDrag(1, 50, 300, 100);
    const { targetX } = dragTarget(d, 150, scale);
    expect((targetX - 100) * scale).toBeCloseTo(120, 9);
  });

  it('slides the anchor at either end so the car turns back at once', () => {
    const d = beginDrag(1, 100, 300, 300);
    const past = dragTarget(d, 200, 1);
    expect(past.targetX).toBe(TARGET_MAX_PX);
    // Back 10 px from the overshoot point: the target leaves the edge right away.
    const back = dragTarget(past.state, 190, 1);
    expect(back.targetX).toBeCloseTo(TARGET_MAX_PX - 12, 9);
    expect(dragTarget(beginDrag(1, 300, 0, 40), 0, 1).targetX).toBe(TARGET_MIN_PX);
  });

  it('re-anchors to the finger and car now (lock release, keys, pointercancel)', () => {
    const d = beginDrag(7, 10, 10, 100);
    const r = reanchor(d, 200, 250, 180);
    expect(r).toEqual({ pointerId: 7, anchorPointerX: 200, anchorTargetX: 180, baseY: 250 });
    expect(dragTarget(r, 200, 0.6).targetX).toBe(180);
  });
});

describe('mode A: the one-sided pull and its ratchet (§3)', () => {
  it('brakes 0 / 500 / 1000 at dy = 18 / 54 / 90 CSS px', () => {
    expect([0, 18, 54, 90, 140].map((dy) => pullBrake(dy))).toEqual([0, 0, 500, 1000, 1000]);
  });

  it('pulls the base up at once and lets it sink at 20 CSS px/s', () => {
    expect(ratchetBase(300, 250, 0.1)).toBe(250);
    expect(ratchetBase(300, 400, 0.5)).toBe(310);
    expect(ratchetBase(300, 305, 1)).toBe(305);
  });

  it('a slow 40 px over 4 s never brakes; the same 40 px in 0.2 s brakes 250', () => {
    const run = (seconds: number) => {
      let d = beginDrag(1, 100, 300, 152);
      let worst = 0;
      const frames = Math.round(seconds * 60);
      for (let f = 1; f <= frames; f++) {
        const m = moveDrag(d, 100, 300 + (40 * f) / frames, 1 / 60, 0.6, 'A');
        d = m.state;
        worst = Math.max(worst, m.brake);
      }
      return worst;
    };
    expect(run(4)).toBe(0);
    expect(run(0.2)).toBe(250);
  });

  it('a 100 px pull holds the hardest brake 0.5 s and is back to full in about 4.1 s', () => {
    let d = beginDrag(1, 100, 300, 152);
    d = moveDrag(d, 100, 400, 0, 0.6, 'A').state;
    let t = 0;
    let fullUntil = -1;
    let releasedAt = -1;
    while (t < 6) {
      const m = moveDrag(d, 100, 400, 0.01, 0.6, 'A');
      d = m.state;
      t += 0.01;
      if (m.brake === 1000) fullUntil = t;
      if (m.brake === 0 && releasedAt < 0) releasedAt = t;
    }
    expect(fullUntil).toBeCloseTo(0.5, 1);
    expect(releasedAt).toBeCloseTo(4.1, 1);
  });

  it('mode B ignores the vertical entirely', () => {
    const d = beginDrag(1, 100, 300, 152);
    const m = moveDrag(d, 120, 500, 0.1, 0.6, 'B');
    expect(m.brake).toBe(0);
    expect(m.state.baseY).toBe(300);
    expect(m.targetX).toBeCloseTo(152 + (20 * INPUT_TUNING.gain) / 0.6, 9);
  });
});

describe('hardest brake, keys and buttons (§3)', () => {
  it('a second finger, ▼, ↓ / S or a tap all mean 1000; otherwise the pull', () => {
    expect(combineBrake({ drag: 300 })).toBe(300);
    expect(combineBrake({ drag: 300, secondFinger: true })).toBe(1000);
    expect(combineBrake({ downButton: true })).toBe(1000);
    expect(combineBrake({ downKey: true })).toBe(1000);
    expect(combineBrake({ tapSteps: 1 })).toBe(1000);
    expect(combineBrake({})).toBe(0);
  });

  it('held keys and ◀ ▶ move the target 440 px/s; a click moves one lane', () => {
    expect(heldTarget(152, 1, 0.1)).toBeCloseTo(196, 9);
    expect(heldTarget(40, -1, 1)).toBe(TARGET_MIN_PX);
    expect(clickTarget(152, 1, 4)).toBe(228);
    expect(clickTarget(152, -1, 5)).toBeCloseTo(91.2, 9);
  });

  it('Buttons never steers from a drag; Quick Rules 2 follows what is live', () => {
    expect(dragSteers('drag')).toBe(true);
    expect(dragSteers('buttons')).toBe(false);
    expect(quickRulesVariant('drag', 'A')).toBe('A');
    expect(quickRulesVariant('drag', 'B')).toBe('B');
    expect(quickRulesVariant('buttons', 'A')).toBe('B');
    expect(DRAG_MAPPING).toBe('A');
  });
});
