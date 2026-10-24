/**
 * Test support for the UI tests (not imported by the app): the board's dev
 * seams, and a driver that races a whole level through the real input path
 * — a finger dragged on the canvas — steering where `planLane` would.
 *
 * The board only exists past its canvas guard, so callers stub the 2D
 * context (`stubCanvas2d`) and silence jsdom's own frames
 * (`stubAnimationFrames`) so `__otFrame` is the loop's only clock (issue
 * #158). A frame of 1000/30 ms runs four steps, the cadence `planLane`'s
 * look-ahead is written for (§6).
 */
import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BOARD_HEIGHT, BOARD_WIDTH, FULL_SPEED, SUB } from '../game/constants';
import { INPUT_TUNING } from '../game/input';
import { planLane } from '../game/planner';
import { courseFor, type RaceState } from '../game/race';

interface Seams {
  __otFrame?: (now: number) => void;
  __otState?: () => RaceState;
}

const seams = () => window as unknown as Seams;

export const FRAME_MS = 1000 / 30;

let clock = 0;

/** The race as the board holds it. */
export function raceState(): RaceState {
  const read = seams().__otState;
  if (!read) throw new Error('no board: the canvas guard did not pass');
  return read();
}

export const hasBoard = (): boolean => typeof seams().__otFrame === 'function';

/** Pumps `count` frames of `ms` each through the dev seam. */
export function pump(count: number, ms = FRAME_MS): void {
  const frame = seams().__otFrame;
  if (!frame) throw new Error('no board: the canvas guard did not pass');
  act(() => {
    for (let i = 0; i < count; i++) {
      clock += ms;
      frame(clock);
    }
  });
}

export const canvasEl = (): HTMLCanvasElement => {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas.ot-canvas');
  if (!canvas) throw new Error('no canvas');
  return canvas;
};

/** Lays the canvas out at the logical size: one CSS px per logical px. */
export function layOutCanvas(): () => void {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: BOARD_WIDTH,
    bottom: BOARD_HEIGHT,
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    toJSON: () => ({}),
  });
  return () => spy.mockRestore();
}

/**
 * Races to the line: one finger down on a ready (or paused) board, then each
 * frame the finger moves so the target lands where `planLane` steers. The
 * finger never pulls down, so the throttle stays full — a Rusher's race,
 * which wins Lv1–10 (§6). Returns the frames it took.
 */
export function driveToFinish(maxFrames = 4_000): number {
  const canvas = canvasEl();
  const course = courseFor(raceState().level);
  let x = 180;
  const y = 400;
  fireEvent.pointerDown(canvas, { pointerId: 41, clientX: x, clientY: y, button: 0 });
  let frames = 0;
  while (raceState().status === 'running' && frames < maxFrames) {
    const race = raceState();
    const decision = planLane(course, race.player, FULL_SPEED);
    // One CSS px per logical px (layOutCanvas): the finger moves the gap ÷ gain.
    x += (decision.steerX - race.player.target) / SUB / INPUT_TUNING.gain;
    fireEvent.pointerMove(canvas, { pointerId: 41, clientX: x, clientY: y });
    pump(1);
    frames += 1;
  }
  fireEvent.pointerUp(canvas, { pointerId: 41, clientX: x, clientY: y });
  return frames;
}
