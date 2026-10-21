/**
 * The input mapping (docs/OVERTAKE_RULES.md §3 — provisional until the Phase 0
 * device trial): fingers, keys and buttons in, `{ steerX, brake }` out. Pure
 * functions; elapsed time arrives as an argument and nothing here reads the
 * DOM or a clock.
 *
 * This is the one file in game/ allowed floating point (§1): CSS px pointer
 * coordinates, the gain, the board's scale. Everything leaves through
 * `toStepInput`, which rounds `steerX` to whole 1/120 px units and floors
 * `brake` to whole ‰ — the physics only ever sees integers.
 *
 * The gate fails closed: a non-finite number (a board not laid out yet has
 * scale 0, and 0 / 0 is NaN) never reaches the physics. A drag with an
 * unusable scale or pointer leaves its state as it was, the brake sources
 * read a non-finite pull as 0, and `toStepInput` turns a non-finite target
 * into `null` (keep the current target) and a non-finite brake into 0.
 */
import {
  BRAKE_MAX,
  DRAG_MAPPING,
  ROAD_WIDTH,
  STEER_PER_STEP,
  SUB,
  X_MAX,
  X_MIN,
} from './constants';
import type { StepInput } from './types';

/** Initial values from the Phase 0 prototype (§3); Phase 0 on devices decides them. */
export interface InputTuning {
  /** On screen, the car moves `gain` × the finger. */
  readonly gain: number;
  /** Mode A: CSS px of downward pull that do nothing. */
  readonly deadZone: number;
  /** Mode A: CSS px of pull for the hardest brake. */
  readonly fullBrakeDistance: number;
  /** Mode A: CSS px/s the ratchet base sinks toward a finger below it. */
  readonly returnSpeed: number;
}

export const INPUT_TUNING: InputTuning = {
  gain: 1.2,
  deadZone: 18,
  fullBrakeDistance: 90,
  returnSpeed: 20,
};

export type DragMapping = 'A' | 'B';
export type Controls = 'drag' | 'buttons';

/** Logical px the lateral target may take (the car-centre clamp, §1). */
export const TARGET_MIN_PX = X_MIN / SUB;
export const TARGET_MAX_PX = X_MAX / SUB;
/** Lateral target speed for keys and ◀ ▶, logical px/s (the car's own, §3). */
export const KEY_STEER_SPEED = STEER_PER_STEP;
/** A keyboard / assistive click on ▼ brakes this many steps (0.5 s, §3). */
export const TAP_BRAKE_STEPS = 60;

/** The steering finger's anchor (§3 "横"). */
export interface DragState {
  readonly pointerId: number;
  /** CSS px. */
  readonly anchorPointerX: number;
  /** Logical px: the car's lateral target when the anchor was taken. */
  readonly anchorTargetX: number;
  /** Mode A ratchet base, CSS px (y grows downward). */
  readonly baseY: number;
}

export function clampTargetPx(x: number): number {
  return Math.min(TARGET_MAX_PX, Math.max(TARGET_MIN_PX, x));
}

/** A board scale a pointer can be mapped through: finite and positive. */
function usableScale(scale: number): boolean {
  return Number.isFinite(scale) && scale > 0;
}

/** Elapsed seconds as a usable non-negative number (non-finite reads as 0). */
function elapsed(dtSeconds: number): number {
  return Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
}

/** Pointer down (or a re-anchor): the finger and the car's target become the reference. */
export function beginDrag(
  pointerId: number,
  pointerX: number,
  pointerY: number,
  carTargetX: number,
): DragState {
  return { pointerId, anchorPointerX: pointerX, anchorTargetX: carTargetX, baseY: pointerY };
}

/**
 * Re-anchors without lifting the finger — after the Bump lock ends, after a
 * key moved the target (§3): lateral to the finger and car now, the ratchet
 * base to the finger now.
 */
export function reanchor(
  state: DragState,
  pointerX: number,
  pointerY: number,
  carTargetX: number,
): DragState {
  return beginDrag(state.pointerId, pointerX, pointerY, carTargetX);
}

/**
 * The lateral target for a finger at pointerX (§3): anchor + Δfinger × gain ÷
 * scale (CSS px → logical px). Past either end the anchor slides so the
 * target sticks to the end and the car turns back the moment the finger does.
 * An unusable scale (≤ 0 or non-finite — a board not laid out yet) or pointer
 * is refused: the target stays at the anchor's and the state is unchanged.
 */
export function dragTarget(
  state: DragState,
  pointerX: number,
  scale: number,
  tuning: InputTuning = INPUT_TUNING,
): { targetX: number; state: DragState } {
  if (!usableScale(scale) || !Number.isFinite(pointerX)) {
    return { targetX: state.anchorTargetX, state };
  }
  const raw = state.anchorTargetX + ((pointerX - state.anchorPointerX) * tuning.gain) / scale;
  if (raw >= TARGET_MIN_PX && raw <= TARGET_MAX_PX) return { targetX: raw, state };
  const targetX = clampTargetPx(raw);
  return { targetX, state: { ...state, anchorPointerX: pointerX, anchorTargetX: targetX } };
}

/**
 * Mode A's ratchet (§3): a finger above the base pulls it up at once; a
 * finger below lets it sink at `returnSpeed` toward the finger.
 */
export function ratchetBase(
  baseY: number,
  pointerY: number,
  dtSeconds: number,
  tuning: InputTuning = INPUT_TUNING,
): number {
  if (pointerY <= baseY) return pointerY;
  return Math.min(pointerY, baseY + tuning.returnSpeed * elapsed(dtSeconds));
}

/** Mode A's brake for a pull dy below the base: 0..1000 (§3). */
export function pullBrake(dy: number, tuning: InputTuning = INPUT_TUNING): number {
  if (!Number.isFinite(dy)) return 0;
  const span = tuning.fullBrakeDistance - tuning.deadZone;
  const t = Math.min(1, Math.max(0, (dy - tuning.deadZone) / span));
  return Math.floor(t * BRAKE_MAX);
}

/**
 * One pointer move of the steering finger, dt seconds after the last: the
 * new target, the brake the drag asks for (0 in mode B, which ignores the
 * vertical, §3), and the updated state. Like `dragTarget`, it refuses an
 * unusable scale or pointer: target at the anchor's, brake 0, state unchanged.
 */
export function moveDrag(
  state: DragState,
  pointerX: number,
  pointerY: number,
  dtSeconds: number,
  scale: number,
  mapping: DragMapping = DRAG_MAPPING,
  tuning: InputTuning = INPUT_TUNING,
): { targetX: number; brake: number; state: DragState } {
  if (!usableScale(scale) || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
    return { targetX: state.anchorTargetX, brake: 0, state };
  }
  const lateral = dragTarget(state, pointerX, scale, tuning);
  if (mapping === 'B') return { targetX: lateral.targetX, brake: 0, state: lateral.state };
  const baseY = ratchetBase(state.baseY, pointerY, dtSeconds, tuning);
  return {
    targetX: lateral.targetX,
    brake: pullBrake(pointerY - baseY, tuning),
    state: { ...lateral.state, baseY },
  };
}

/** The hardest-brake sources of §3 "最大減速"; several at once still mean 1000. */
export interface BrakeSources {
  /** Mode A's pull, 0..1000. */
  readonly drag?: number;
  /** A second finger on the board (Drag only). */
  readonly secondFinger?: boolean;
  /** ▼ held. */
  readonly downButton?: boolean;
  /** ↓ / S held. */
  readonly downKey?: boolean;
  /** Steps left of a keyboard / assistive ▼ click. */
  readonly tapSteps?: number;
}

export function combineBrake(sources: BrakeSources): number {
  if (
    sources.secondFinger === true ||
    sources.downButton === true ||
    sources.downKey === true ||
    (sources.tapSteps ?? 0) > 0
  ) {
    return BRAKE_MAX;
  }
  const drag = sources.drag ?? 0;
  return Number.isFinite(drag) ? Math.min(BRAKE_MAX, Math.max(0, drag)) : 0;
}

/** ← → / A D and ◀ ▶ held: the target moves 440 px/s (§3). dir is −1, 0 or 1. */
export function heldTarget(targetX: number, dir: number, dtSeconds: number): number {
  if (!Number.isFinite(targetX)) return targetX;
  const sign = Number.isFinite(dir) ? Math.sign(dir) : 0;
  return clampTargetPx(targetX + sign * KEY_STEER_SPEED * elapsed(dtSeconds));
}

/** A keyboard / assistive click on ◀ ▶ moves the target one lane (§3). */
export function laneStepPx(lanes: number): number {
  return ROAD_WIDTH / SUB / lanes;
}

export function clickTarget(targetX: number, dir: number, lanes: number): number {
  return clampTargetPx(targetX + Math.sign(dir) * laneStepPx(lanes));
}

/**
 * The integer input the physics reads (§1) — the only way out of this file.
 * A non-finite target means "keep the current one" (null); a non-finite brake
 * means full throttle (0).
 */
export function toStepInput(targetXPx: number | null, brake: number): StepInput {
  return {
    steerX: targetXPx === null || !Number.isFinite(targetXPx) ? null : Math.round(targetXPx * SUB),
    brake: Number.isFinite(brake) ? Math.min(BRAKE_MAX, Math.max(0, Math.floor(brake))) : 0,
  };
}

/** Whether a drag on the board steers at all (Buttons: never, §3). */
export function dragSteers(controls: Controls): boolean {
  return controls === 'drag';
}

/** Which Quick Rules step 2 to show (§10): mode A's wording only for Drag on mapping A. */
export function quickRulesVariant(
  controls: Controls,
  mapping: DragMapping = DRAG_MAPPING,
): DragMapping {
  return controls === 'drag' && mapping === 'A' ? 'A' : 'B';
}
