/**
 * The input mapping, the frame clock and the score arithmetic
 * (docs/BOUNCE_UP_RULES.md §2「フレームとステップ」, §4).
 */
import { describe, expect, it } from 'vitest';
import { FRAME_UNITS_PER_STEP, MAX_STEPS_PER_FRAME, SUB } from './constants';
import { FRAME_CAP_UNITS, frameSteps } from './frame';
import { dragUnits, frameInputs, heldDirection } from './input';
import { bestLineHeight, bookRun, scoreOf } from './score';
import { report } from './test-helpers';

describe('drag (§4)', () => {
  it('maps CSS px to logical units 1:1 with what the board shows', () => {
    expect(dragUnits(10, 1)).toBe(10 * SUB);
    // A board drawn at 0.72 × : 7.2 CSS px is 10 logical px.
    expect(dragUnits(7.2, 0.72)).toBe(10 * SUB);
    expect(dragUnits(-3, 1.5)).toBe(-2 * SUB);
    expect(Number.isInteger(dragUnits(0.3333, 0.77))).toBe(true);
  });

  it('fails closed: no layout yet, or a non-finite movement, moves nothing', () => {
    expect(dragUnits(10, 0)).toBe(0);
    expect(dragUnits(10, -1)).toBe(0);
    expect(dragUnits(10, Number.NaN)).toBe(0);
    expect(dragUnits(Number.POSITIVE_INFINITY, 1)).toBe(0);
    expect(dragUnits(1e300, 1e-300)).toBe(0);
  });

  it('a frame gives its gathered drag to its first step only', () => {
    expect(frameInputs(3, 500, 0)).toEqual([
      { drag: 500, dir: 0 },
      { drag: 0, dir: 0 },
      { drag: 0, dir: 0 },
    ]);
    expect(frameInputs(2, 0, -1).every((i) => i.dir === -1)).toBe(true);
    expect(frameInputs(0, 500, 1)).toEqual([]);
  });
});

describe('keys and ◀ ▶ (§4)', () => {
  it('held left / right; both cancel', () => {
    expect(heldDirection(true, false)).toBe(-1);
    expect(heldDirection(false, true)).toBe(1);
    expect(heldDirection(true, true)).toBe(0);
    expect(heldDirection(false, false)).toBe(0);
  });
});

describe('frame time to steps, the carry capped (§2)', () => {
  it('a 60 Hz frame runs two steps, a 120 Hz frame one', () => {
    let carry = 0;
    let steps = 0;
    for (let f = 0; f < 60; f++) {
      const r = frameSteps(carry, 1000 / 60);
      steps += r.steps;
      carry = r.carry;
    }
    expect(steps).toBe(120);
    const one = frameSteps(0, 1000 / 120);
    expect(one.steps).toBe(1);
  });

  it('never runs more than 6 steps a frame and never carries more than one step', () => {
    let worstSteps = 0;
    let worstCarry = 0;
    let carry = 0;
    for (const dt of [0, 3, 8.3, 16.7, 33.3, 50, 100, 1000, 60_000, 4.2, 16.7]) {
      const r = frameSteps(carry, dt);
      worstSteps = Math.max(worstSteps, r.steps);
      worstCarry = Math.max(worstCarry, r.carry);
      expect(r.steps).toBeLessThanOrEqual(MAX_STEPS_PER_FRAME);
      expect(r.carry).toBeLessThan(FRAME_UNITS_PER_STEP);
      carry = r.carry;
    }
    // Back from a minute in the background: still six steps.
    expect(frameSteps(0, 60_000)).toEqual({ steps: 6, carry: 0 });
    expect(frameSteps(999, 60_000)).toEqual({ steps: 6, carry: 0 });
    report(
      'frame cap',
      `${worstSteps} steps`,
      `carry < ${FRAME_UNITS_PER_STEP} units`,
      `cap ${FRAME_CAP_UNITS}`,
    );
  });

  it('fails closed on a bad clock: negative, NaN, infinite time is 0; a bad carry is 0', () => {
    expect(frameSteps(0, -16)).toEqual({ steps: 0, carry: 0 });
    expect(frameSteps(500, Number.NaN)).toEqual({ steps: 0, carry: 500 });
    expect(frameSteps(0, Number.POSITIVE_INFINITY)).toEqual({ steps: 0, carry: 0 });
    expect(frameSteps(Number.NaN, 10)).toEqual({ steps: 1, carry: 200 });
    expect(frameSteps(-5, 0)).toEqual({ steps: 0, carry: 0 });
  });
});

describe('score and booking (§4, §5)', () => {
  it('points are floor(px / 10), with no unit', () => {
    expect(scoreOf(0)).toBe(0);
    expect(scoreOf(-500)).toBe(0);
    expect(scoreOf(9 * SUB + 119)).toBe(0);
    expect(scoreOf(10 * SUB)).toBe(1);
    expect(scoreOf(18_875)).toBe(15); // one bounce off the floor: 157.29 px
    expect(scoreOf(Number.NaN)).toBe(0);
  });

  it('the best line sits at best × 10 px', () => {
    expect(bestLineHeight(0)).toBe(0);
    expect(bestLineHeight(123)).toBe(1230 * SUB);
    expect(bestLineHeight(-1)).toBe(0);
  });

  it('booking adds only the new points, and booking twice adds nothing', () => {
    let booked = 0;
    let total = 0;
    for (const score of [0, 15, 15, 40, 38, 40, 41]) {
      const r = bookRun(booked, score);
      total += r.add;
      booked = r.booked;
      expect(r.add).toBeGreaterThanOrEqual(0);
    }
    expect(total).toBe(41);
    expect(booked).toBe(41);
    expect(bookRun(Number.NaN, 5)).toEqual({ add: 5, booked: 5 });
  });
});
