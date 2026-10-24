/**
 * Overtake's pure logic (docs/OVERTAKE_RULES.md): what state/ and ui/ may use.
 * The reference bots and the calibration (bots.ts, calibrate.ts) are left
 * out on purpose — tests only, never the app (§6).
 */
export * from './constants';
export type * from './types';
export { COAST } from './types';
export { ALL_CLEARED, LEVEL_COUNT, clampLevel, levelSpec, type LevelSpec } from './levels';
export { generateCourse } from './course';
export { verifyRoute } from './route';
export { laneCenter, laneLeft, laneWidth } from './geometry';
export { newCar, stepCar, targetSpeed } from './physics';
export { planLane, type Decision } from './planner';
export { paceCap } from './pace';
export { RIVAL_PACE, type PaceRow } from './rivalPace';
export { simulateRivals } from './rivals';
export {
  courseFor,
  createRace,
  livePlace,
  pauseRace,
  progressPermille,
  resumeRace,
  startRace,
  stepRace,
  type RaceState,
  type RaceStatus,
  type RivalState,
} from './race';
export * from './input';
export * from './progress';
