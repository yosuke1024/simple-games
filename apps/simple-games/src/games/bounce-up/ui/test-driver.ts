/**
 * Test support for the UI tests (not imported by the app): the board's dev
 * seams, and a driver that climbs and then falls through the real input
 * path — one finger dragged on the canvas.
 *
 * The board only exists past its canvas guard, so callers stub the 2D
 * context (`stubCanvas2d`) and silence jsdom's own frames — with
 * `stubAnimationFrames`, or with the queue below that runs only when told to —
 * so the test is the loop's only clock (issue #158). A frame of 1000/120 ms
 * runs exactly one step (game/frame.ts: 1,000 time units), so what the driver
 * decides from the state before a frame is exactly the input of that frame's
 * one step.
 *
 * Where to fall is found, not guessed: from the board's own state, the pure
 * `step` is run ahead to plan a way down (`planFall`), and the same input then
 * goes through the UI, so the board does what the look-ahead did.
 *
 * The towers are the same on every run of a test: the provider's seed is
 * `Date.now` and `Math.random` (state/GameContext.tsx `freshSeed`), and the
 * tests hold both (`holdEntropy` for the second).
 */
import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BOARD_HEIGHT_PX, BOARD_WIDTH_PX, SUB } from '../game/constants';
import { step } from '../game/physics';
import type { Platform, RunState } from '../game/types';

interface Seams {
  __boFrame?: (now: number) => void;
  __boState?: () => RunState;
}

const seams = () => window as unknown as Seams;

/** One fixed step per frame. */
export const STEP_FRAME_MS = 1000 / 120;

let clock = 0;

/**
 * Holds `Math.random` to a fixed sequence — the k-th call returns k·φ mod 1 —
 * so the seeds the provider makes are the same on every run of a test, and
 * still differ from one run to the next within it. Returns a restore function.
 */
export function holdEntropy(): () => void {
  let k = 0;
  const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
    k += 1;
    return (k * 0.6180339887498949) % 1;
  });
  return () => spy.mockRestore();
}

/** The run as the board holds it. */
export function runState(): RunState {
  const read = seams().__boState;
  if (!read) throw new Error('no board: the canvas guard did not pass');
  return read();
}

export const hasBoard = (): boolean => typeof seams().__boFrame === 'function';

/** Pumps `count` frames of `ms` each through the dev seam. */
export function pump(count: number, ms = STEP_FRAME_MS): void {
  const frame = seams().__boFrame;
  if (!frame) throw new Error('no board: the canvas guard did not pass');
  act(() => {
    for (let i = 0; i < count; i++) {
      clock += ms;
      frame(clock);
    }
  });
}

export interface FrameQueue {
  /** Runs `count` rounds: each runs the frames requested before it, `ms` later. */
  run(count: number, ms?: number): void;
  /** Frames requested and neither run nor cancelled. */
  pending(): number;
  /** Puts jsdom's own requestAnimationFrame / cancelAnimationFrame back. */
  restore(): void;
}

/**
 * Replaces jsdom's animation frames with a queue the test runs by hand, on the
 * same clock as `pump`. The board still asks for every frame through
 * requestAnimationFrame and cancels it through cancelAnimationFrame, so a
 * resource tracker wrapped around these sees frames that really run — but
 * when they run is the test's choice, not jsdom's 16 ms timer under whatever
 * load the machine has.
 */
export function queueAnimationFrames(): FrameQueue {
  const request = window.requestAnimationFrame;
  const cancel = window.cancelAnimationFrame;
  const queued = new Map<number, FrameRequestCallback>();
  let nextHandle = 1;
  window.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const handle = nextHandle++;
    queued.set(handle, callback);
    return handle;
  };
  window.cancelAnimationFrame = (handle: number) => {
    queued.delete(handle);
  };
  return {
    run(count, ms = STEP_FRAME_MS) {
      act(() => {
        for (let i = 0; i < count; i++) {
          clock += ms;
          const due = [...queued.values()];
          queued.clear();
          for (const callback of due) callback(clock);
        }
      });
    },
    pending: () => queued.size,
    restore() {
      window.requestAnimationFrame = request;
      window.cancelAnimationFrame = cancel;
    },
  };
}

export const canvasEl = (): HTMLCanvasElement => {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas.bo-canvas');
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
    right: BOARD_WIDTH_PX,
    bottom: BOARD_HEIGHT_PX,
    width: BOARD_WIDTH_PX,
    height: BOARD_HEIGHT_PX,
    toJSON: () => ({}),
  });
  return () => spy.mockRestore();
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The body's speed when the driver steers: 3/4 of RUN_SPEED, as the reference bot. */
const CAP = 450;

/** The drag (units) that moves the body toward `goal` (units) this step, no wrap. */
export function dragToward(s: RunState, goal: number): number {
  const want = s.x + clamp(goal - s.x, -CAP, CAP);
  return want - s.target;
}

/** The lowest chain platform above `top`, or null. */
function nextChain(platforms: readonly Platform[], top: number): Platform | null {
  for (const p of platforms) if (p.chain && p.top > top) return p;
  return null;
}

/** A finger on the canvas, moved by whole units (one CSS px per logical px). */
export class Finger {
  private x = 180;
  constructor(private readonly id = 7) {}

  down(): void {
    fireEvent.pointerDown(canvasEl(), {
      pointerId: this.id,
      pointerType: 'touch',
      clientX: this.x,
      clientY: 400,
      button: 0,
    });
  }

  move(units: number): void {
    if (units === 0) return;
    this.x += units / SUB;
    fireEvent.pointerMove(canvasEl(), { pointerId: this.id, clientX: this.x, clientY: 400 });
  }

  up(): void {
    fireEvent.pointerUp(canvasEl(), { pointerId: this.id, clientX: this.x, clientY: 400 });
  }
}

/**
 * Climbs the safety chain until a platform of `segment` is landed on, a step
 * per frame, steering as the reference bot does (game/bot.ts). The finger
 * must be down and the run running. Returns the frames it took.
 */
export function climbTo(finger: Finger, segment: number, maxFrames = 20_000): number {
  let landedTop = runState().y;
  let frames = 0;
  while (runState().reachedSegment < segment && frames < maxFrames) {
    const s = runState();
    if (s.status !== 'running') throw new Error(`run stopped climbing: ${s.status}`);
    const goal = nextChain(s.platforms, landedTop);
    if (goal !== null) finger.move(dragToward(s, goal.left + Math.floor(goal.width / 2)));
    pump(1);
    const after = runState();
    if (after.event === 'bounce' || after.event === 'vanish') landedTop = after.y;
    frames += 1;
  }
  if (runState().reachedSegment < segment) throw new Error('did not climb in time');
  return frames;
}

/** The columns the fall is steered at, px: every 12 px across the board. */
const COLUMNS: readonly number[] = Array.from(
  { length: Math.ceil((BOARD_WIDTH_PX - 6) / 12) },
  (_, i) => 6 + i * 12,
);

/**
 * Steps one leg may take before it is given up: a safety net, far above what a
 * leg takes (a bounce lands back on its own height in 101 steps — RULES §10).
 */
const LEG_STEPS = 1_000;

/** Landings the search expands before it gives up. */
const PLAN_LANDINGS = 64;

/**
 * Steers at column `goal` from `from` until the body lands (a bounce or a
 * vanish), the run ends, or LEG_STEPS pass. Returns the state it ends in and
 * the steps taken.
 */
function leg(from: RunState, goal: number): { end: RunState; steps: number } {
  let s = from;
  for (let k = 1; k <= LEG_STEPS; k++) {
    s = step(s, { drag: dragToward(s, goal), dir: 0 });
    if (s.status !== 'running' || s.event === 'bounce' || s.event === 'vanish') {
      return { end: s, steps: k };
    }
  }
  return { end: s, steps: LEG_STEPS };
}

interface Landing {
  readonly state: RunState;
  /** The column steered at on each step from the root to here, units. */
  readonly goals: readonly number[];
}

/**
 * The column to steer at on each step, from `from` until the body has fallen
 * out of view — or null if no way down was found within PLAN_LANDINGS
 * landings. A search over landings with the pure `step`: from the start and
 * from every landing it reaches, each column is steered at until the next
 * landing or the fall. A height already landed on is not expanded again, and
 * the lowest landing still open is expanded next (the lower the body, the
 * less is left below it). One column held all the way down is not enough on
 * every tower: where a cloud below catches the body in every column, the way
 * out goes through a lower cloud first.
 */
export function planFall(from: RunState): number[] | null {
  if (from.status !== 'running') return null;
  const seen = new Set<number>([from.y]);
  const open: Landing[] = [{ state: from, goals: [] }];
  for (let expanded = 0; expanded < PLAN_LANDINGS && open.length > 0; expanded++) {
    let lowest = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.state.y < open[lowest]!.state.y) lowest = i;
    }
    const node = open.splice(lowest, 1)[0]!;
    for (const px of COLUMNS) {
      const goal = px * SUB;
      const { end, steps } = leg(node.state, goal);
      if (end.status === 'over') return [...node.goals, ...new Array<number>(steps).fill(goal)];
      if (end.status !== 'running' || seen.has(end.y)) continue;
      if (end.event !== 'bounce' && end.event !== 'vanish') continue;
      seen.add(end.y);
      open.push({ state: end, goals: [...node.goals, ...new Array<number>(steps).fill(goal)] });
    }
  }
  return null;
}

/**
 * Lets the body fall out of view through the real input path: the way down is
 * planned on the board's state with the pure `step` (`planFall`), and the same
 * steering is then handed to the board one frame at a time. Returns the
 * frames it took; throws if no way down was found or the board did not follow.
 */
export function fallOff(finger: Finger): number {
  const goals = planFall(runState());
  if (goals === null) throw new Error(`no way down within ${PLAN_LANDINGS} landings`);
  for (const goal of goals) {
    finger.move(dragToward(runState(), goal));
    pump(1);
  }
  if (runState().status !== 'over') throw new Error('the board did not fall as planned');
  return goals.length;
}
