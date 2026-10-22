/**
 * Height to points, and the one booking path's arithmetic
 * (docs/BOUNCE_UP_RULES.md §4「スコアと高さ」, §5).
 */
import { SCORE_PX, SUB } from './constants';
import type { RunState } from './types';

/** Points for a height in units: floor(px / SCORE_PX) (§4). */
export function scoreOf(maxHeight: number): number {
  if (!Number.isSafeInteger(maxHeight) || maxHeight <= 0) return 0;
  return Math.floor(maxHeight / (SCORE_PX * SUB));
}

export function runScore(s: RunState): number {
  return scoreOf(s.maxHeight);
}

/** The height (units) of the personal-best line for a best score (§4). */
export function bestLineHeight(bestScore: number): number {
  if (!Number.isSafeInteger(bestScore) || bestScore <= 0) return 0;
  return bestScore * SCORE_PX * SUB;
}

/**
 * The booking step (§5): given the points already booked for this run and its
 * score now, what to add to the total and the new booked mark. A run's score
 * never drops, so the delta is ≥ 0, and booking twice adds nothing.
 */
export function bookRun(booked: number, score: number): { add: number; booked: number } {
  const b = Number.isSafeInteger(booked) && booked > 0 ? booked : 0;
  const s = Number.isSafeInteger(score) && score > 0 ? score : 0;
  if (s <= b) return { add: 0, booked: b };
  return { add: s - b, booked: s };
}
