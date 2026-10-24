/**
 * Frame time to fixed steps, with the carry capped (docs/BOUNCE_UP_RULES.md
 * §2「フレームとステップ」). Time is counted in whole 1/120,000 s, so a step
 * is exactly FRAME_UNITS_PER_STEP of them and nothing accumulates a float.
 * Neither the steps run nor the carry kept ever exceed MAX_STEPS_PER_FRAME:
 * back from the background, or on a slow device, the world falls behind
 * rather than running a burst of steps.
 */
import { FRAME_UNITS_PER_MS, FRAME_UNITS_PER_STEP, MAX_STEPS_PER_FRAME } from './constants';

export interface FrameSteps {
  /** Steps to run this frame, 0..MAX_STEPS_PER_FRAME. */
  readonly steps: number;
  /** Time carried to the next frame, 0..FRAME_UNITS_PER_STEP − 1. */
  readonly carry: number;
}

export const FRAME_CAP_UNITS = MAX_STEPS_PER_FRAME * FRAME_UNITS_PER_STEP;

/** dtMs is the frame's elapsed time; non-finite or negative reads as 0. */
export function frameSteps(carry: number, dtMs: number): FrameSteps {
  const dt =
    Number.isFinite(dtMs) && dtMs > 0
      ? Math.min(FRAME_CAP_UNITS, Math.round(dtMs * FRAME_UNITS_PER_MS))
      : 0;
  const c = Number.isSafeInteger(carry) && carry > 0 ? Math.min(carry, FRAME_CAP_UNITS) : 0;
  const total = Math.min(FRAME_CAP_UNITS, c + dt);
  const steps = Math.floor(total / FRAME_UNITS_PER_STEP);
  return { steps, carry: total - steps * FRAME_UNITS_PER_STEP };
}
