/**
 * The pace calibration (docs/OVERTAKE_RULES.md §6 "目標のタイム"), pure and
 * deterministic. It runs only at development time — `OT_REGEN_PACE=1` on
 * game/rivalPace.test.ts prints a new RIVAL_PACE — never in the app and never
 * in the ordinary test run (§6, §18).
 *
 * 1. B_ref (the intermediate B bot, noise seed `overtake-calibrate`) runs the
 *    course alone from the player's grid slot: S_B steps.
 * 2. T_1 = ceil(S_B × (1000 + s‰) / 1000); T_2, T_3 = T_1 × 1.04, × 1.09
 *    (rounded to the nearest step).
 * 3. For each rival, the mean c ∈ 60..420 whose rivals-only run from that
 *    rival's grid slot lands nearest its target; ties go to the larger c. The
 *    goal step is not monotone in c (the planner's speed grid moves with c),
 *    so the exhaustive search over all 361 values is the definition; the
 *    bracketed search is the shortcut the generator uses, checked against
 *    the exhaustive one on sample levels (game/rivalPace.test.ts).
 * 4. c_2 = min(c_2, c_1), c_3 = min(c_3, c_2).
 */
import { FULL_SPEED, MIN_TARGET_SPEED, RIVAL_TIME_RATIOS } from './constants';
import { CALIBRATION_SEED, controllerFor, runBot, skill } from './bots';
import { generateCourse } from './course';
import { levelSpec } from './levels';
import { simulateRivals } from './rivals';
import type { PaceRow } from './rivalPace';
import type { Course } from './types';

/** S_B: B_ref's steps from the player's grid slot to the line, alone (§6). */
export function referenceSteps(course: Course): number | null {
  const run = runBot(course, controllerFor(course, 'B', skill('intermediate', CALIBRATION_SEED)));
  return run.finishStep;
}

/** [T_1, T_2, T_3] for a level from S_B (§6). */
export function calibrationTargets(level: number, referenceStepCount: number): PaceRow {
  const slack = levelSpec(level).slack;
  const t1 = Math.ceil((referenceStepCount * (1000 + slack)) / 1000);
  const t2 = Math.floor((t1 * RIVAL_TIME_RATIOS[1] + 500) / 1000);
  const t3 = Math.floor((t1 * RIVAL_TIME_RATIOS[2] + 500) / 1000);
  return [t1, t2, t3];
}

/** Rival `index` (0-based) alone with mean `mean`: its goal step, or null. */
export function rivalSteps(
  course: Course,
  level: number,
  index: number,
  mean: number,
): number | null {
  const means = [0, 0, 0];
  means[index] = mean;
  return simulateRivals(course, level, undefined, { means, only: [index] }).finish[index] ?? null;
}

export interface MeanSearch {
  readonly mean: number;
  readonly steps: number | null;
  /** Rival runs the search used. */
  readonly runs: number;
}

function better(
  candidate: { mean: number; steps: number | null },
  best: { mean: number; steps: number | null } | null,
  target: number,
): boolean {
  if (candidate.steps === null) return best === null;
  if (best === null || best.steps === null) return true;
  const d = Math.abs(candidate.steps - target);
  const e = Math.abs(best.steps - target);
  return d < e || (d === e && candidate.mean > best.mean);
}

/** The definition: every mean 60..420. */
export function searchMeanExhaustive(
  course: Course,
  level: number,
  index: number,
  target: number,
): MeanSearch {
  let best: { mean: number; steps: number | null } | null = null;
  let runs = 0;
  for (let mean = MIN_TARGET_SPEED; mean <= FULL_SPEED; mean++) {
    const steps = rivalSteps(course, level, index, mean);
    runs += 1;
    const candidate = { mean, steps };
    if (better(candidate, best, target)) best = candidate;
  }
  return { mean: best!.mean, steps: best!.steps, runs };
}

/** Half-width of the window scanned around the bisection's answer. */
export const BRACKET_WINDOW = 8;

/**
 * The shortcut: bisect for the slowest mean that still makes the target,
 * then scan ±BRACKET_WINDOW around it; the best of everything evaluated wins.
 */
export function searchMeanBracketed(
  course: Course,
  level: number,
  index: number,
  target: number,
): MeanSearch {
  const seen = new Map<number, number | null>();
  const steps = (mean: number): number | null => {
    if (!seen.has(mean)) seen.set(mean, rivalSteps(course, level, index, mean));
    return seen.get(mean)!;
  };
  let lo = MIN_TARGET_SPEED;
  let hi = FULL_SPEED;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const s = steps(mid);
    if (s !== null && s <= target) hi = mid;
    else lo = mid + 1;
  }
  for (let m = lo - BRACKET_WINDOW; m <= lo + BRACKET_WINDOW; m++) {
    if (m >= MIN_TARGET_SPEED && m <= FULL_SPEED) steps(m);
  }
  let best: { mean: number; steps: number | null } | null = null;
  for (const [mean, s] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
    const candidate = { mean, steps: s };
    if (better(candidate, best, target)) best = candidate;
  }
  return { mean: best!.mean, steps: best!.steps, runs: seen.size };
}

export interface LevelCalibration {
  readonly level: number;
  readonly referenceSteps: number;
  readonly targets: PaceRow;
  readonly pace: PaceRow;
  readonly runs: number;
}

export function calibrateLevel(
  level: number,
  search: 'bracketed' | 'exhaustive' = 'bracketed',
): LevelCalibration {
  const course = generateCourse(level);
  const sB = referenceSteps(course);
  if (sB === null) throw new Error(`B_ref did not finish level ${level}`);
  const targets = calibrationTargets(level, sB);
  const find = search === 'exhaustive' ? searchMeanExhaustive : searchMeanBracketed;
  const found = [0, 1, 2].map((i) => find(course, level, i, targets[i]!));
  const c1 = found[0]!.mean;
  const c2 = Math.min(found[1]!.mean, c1);
  const c3 = Math.min(found[2]!.mean, c2);
  return {
    level,
    referenceSteps: sB,
    targets,
    pace: [c1, c2, c3],
    runs: found.reduce((n, f) => n + f.runs, 1),
  };
}

/** RIVAL_PACE as TypeScript source, ten levels per line. */
export function formatPaceTable(rows: readonly PaceRow[]): string {
  const lines: string[] = [];
  for (let i = 0; i < rows.length; i += 10) {
    const chunk = rows.slice(i, i + 10).map((r) => `[${r.join(', ')}]`);
    lines.push(`  // Lv${i + 1}–${Math.min(i + 10, rows.length)}`);
    lines.push(`  ${chunk.join(', ')},`);
  }
  return lines.join('\n');
}
