/**
 * A rival's speed cap (docs/OVERTAKE_RULES.md §6 "ペース"): the frozen mean
 * c_i from RIVAL_PACE, swung ±6 % by an integer triangle wave over the
 * course position. A function of (level, rival, position) only — no player
 * state reaches it (no rubber-banding, §6).
 */
import {
  FULL_SPEED,
  MIN_TARGET_SPEED,
  PACE_PERIOD,
  PACE_PHASE,
  PACE_SWING_PERCENT,
  SUB,
} from './constants';

/**
 * cap_i(r) = min(420, c + floor(c × 6 × (2t − P) / (100 × P))), with
 * q = ((r_px + φ_i) mod P), t = |2q − P|. Floored at the 60 px/s a brake can
 * reach (a cap below it could not be held anyway).
 */
export function paceCap(mean: number, rival: number, r: number): number {
  const rPx = Math.floor(r / SUB);
  const phase = (rival - 1) * PACE_PHASE;
  const q = (((rPx + phase) % PACE_PERIOD) + PACE_PERIOD) % PACE_PERIOD;
  const t = Math.abs(2 * q - PACE_PERIOD);
  const swing = Math.floor(
    (mean * PACE_SWING_PERCENT * (2 * t - PACE_PERIOD)) / (100 * PACE_PERIOD),
  );
  return Math.max(MIN_TARGET_SPEED, Math.min(FULL_SPEED, mean + swing));
}
