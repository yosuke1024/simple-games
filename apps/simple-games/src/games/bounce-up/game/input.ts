/**
 * The input mapping (docs/BOUNCE_UP_RULES.md §4): fingers, keys and buttons
 * in, `{ drag, dir }` out. Pure functions; nothing here reads the DOM or a
 * clock.
 *
 * This is one of the two places in game/ allowed floating point (§2): CSS px
 * pointer movement and the board's scale. Everything leaves as whole 1/120 px
 * units, and the gate fails closed — a board not laid out yet (scale 0) or a
 * non-finite movement moves nothing.
 */
import { SUB } from './constants';
import type { StepInput } from './types';

/**
 * A finger's sideways movement on screen (CSS px) as logical units, 1:1 with
 * what the board shows: CSS px ÷ scale (CSS px per logical px) × SUB, rounded.
 */
export function dragUnits(dxCss: number, scale: number): number {
  if (!Number.isFinite(dxCss) || !Number.isFinite(scale) || scale <= 0) return 0;
  const units = Math.round((dxCss / scale) * SUB);
  return Number.isSafeInteger(units) ? units : 0;
}

/** ← → / A D and ◀ ▶ held: −1, 0 or 1; both at once cancel (§4). */
export function heldDirection(left: boolean, right: boolean): number {
  if (left === right) return 0;
  return left ? -1 : 1;
}

/**
 * The inputs for one frame's `steps` steps (§4): the drag gathered since the
 * last frame goes to the first step whole, the rest get 0 — never dropped,
 * never counted twice. The held direction applies to every step.
 */
export function frameInputs(steps: number, dragTotal: number, dir: number): StepInput[] {
  const out: StepInput[] = [];
  for (let k = 0; k < steps; k++) out.push({ drag: k === 0 ? dragTotal : 0, dir });
  return out;
}
