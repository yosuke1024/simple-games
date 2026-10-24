/**
 * One race (docs/OVERTAKE_RULES.md §2): ready → running ⇄ paused → finished.
 * There is no death and no "over": every race ends in a place.
 *
 * `stepRace` is the pure step the board's loop calls up to six times a frame:
 * the player's car under the input, then each rival under its own decision
 * (made every DECISION_INTERVAL steps from the course and its own state only,
 * §6). The world stops on the step the player's front crosses the line.
 */
import { PLAYER_START, RIVAL_COUNT, ROLLING_START_SPEED } from './constants';
import { generateCourse } from './course';
import { clampLevel } from './levels';
import { advanceCar, freeze, newCar, newReport, toMutable } from './physics';
import { advanceRival, paceRow, rivalStart, type MutableRival } from './rivals';
import { RIVAL_PACE, type PaceRow } from './rivalPace';
import type { CarState, Course, StepInput } from './types';

export type RaceStatus = 'ready' | 'running' | 'paused' | 'finished';

export interface RivalState {
  readonly car: CarState;
  /** The decision being held (§6). */
  readonly decision: StepInput;
  /** Steps run when this rival crossed the line, or null. */
  readonly finish: number | null;
}

export interface RaceState {
  readonly level: number;
  readonly status: RaceStatus;
  /** Steps run since the start. */
  readonly step: number;
  readonly player: CarState;
  readonly rivals: readonly RivalState[];
  /** Steps run when the player crossed the line, or null. */
  readonly finish: number | null;
  /** The final place, set on the finishing step. */
  readonly place: number | null;
  /** What the last step did to the player (sound, re-anchoring — §3, §11). */
  readonly bumped: boolean;
  readonly lockReleased: boolean;
}

export function createRace(level: number): RaceState {
  const l = clampLevel(level);
  const rivals: RivalState[] = [];
  for (let i = 0; i < RIVAL_COUNT; i++) {
    const r = rivalStart(i, 0);
    rivals.push({ car: freeze(r.car), decision: r.decision, finish: null });
  }
  return {
    level: l,
    status: 'ready',
    step: 0,
    player: newCar(PLAYER_START.r, PLAYER_START.x, 0),
    rivals,
    finish: null,
    place: null,
    bumped: false,
    lockReleased: false,
  };
}

/** The course of a level — the same every time (§5). */
export function courseFor(level: number): Course {
  return generateCourse(clampLevel(level));
}

/** The first input of `ready`: every racer rolls at 240 px/s (§2). */
export function startRace(state: RaceState): RaceState {
  if (state.status !== 'ready') return state;
  return {
    ...state,
    status: 'running',
    player: { ...state.player, w: ROLLING_START_SPEED },
    rivals: state.rivals.map((r) => ({ ...r, car: { ...r.car, w: ROLLING_START_SPEED } })),
  };
}

export function pauseRace(state: RaceState): RaceState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

/** Only the player resumes a race (§2) — the caller decides when that is. */
export function resumeRace(state: RaceState): RaceState {
  return state.status === 'paused' ? { ...state, status: 'running' } : state;
}

/** Place while running (§2): 1 + rivals home or ahead of the player's front (ties go to the player). */
export function livePlace(state: RaceState): number {
  let ahead = 0;
  for (const rival of state.rivals) {
    if (rival.finish !== null || rival.car.r > state.player.r) ahead += 1;
  }
  return 1 + ahead;
}

/** Progress 0..1000 along the course for the progress bar (§11). */
export function progressPermille(course: Course, r: number): number {
  return Math.min(1000, Math.max(0, Math.floor((r * 1000) / course.length)));
}

export function stepRace(
  course: Course,
  state: RaceState,
  input: StepInput,
  table: readonly PaceRow[] = RIVAL_PACE,
): RaceState {
  if (state.status !== 'running') return state;
  const player = toMutable(state.player);
  const report = advanceCar(course, player, input, newReport());
  const means = paceRow(state.level, table);
  const rivals: RivalState[] = state.rivals.map((r, i) => {
    const m: MutableRival = { car: toMutable(r.car), decision: r.decision, finish: r.finish };
    advanceRival(course, m, i, means[i]!, state.step);
    return { car: freeze(m.car), decision: m.decision, finish: m.finish };
  });
  const step = state.step + 1;
  const crossed = player.r >= course.length;
  let place: number | null = null;
  if (crossed) {
    place = 1;
    for (const r of rivals) if (r.finish !== null && r.finish < step) place += 1;
  }
  return {
    ...state,
    status: crossed ? 'finished' : 'running',
    step,
    player: freeze(player),
    rivals,
    finish: crossed ? step : null,
    place,
    bumped: report.bumped,
    lockReleased: report.lockReleased,
  };
}
