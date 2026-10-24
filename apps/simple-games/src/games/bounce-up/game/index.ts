/**
 * Bounce Up's pure logic (docs/BOUNCE_UP_RULES.md): what state/ and ui/ may
 * use. The reference bot (bot.ts) is left out on purpose — tests only (§3).
 */
export * from './constants';
export type * from './types';
export {
  chainDistance,
  gapRange,
  generateSegment,
  generateTower,
  platformLeft,
  type Segment,
} from './generate';
export {
  NO_INPUT,
  airSteps,
  apexUnits,
  createRun,
  leftAt,
  overlaps,
  pause,
  resume,
  start,
  step,
} from './physics';
export { dragUnits, frameInputs, heldDirection } from './input';
export { FRAME_CAP_UNITS, frameSteps, type FrameSteps } from './frame';
export { bestLineHeight, bookRun, runScore, scoreOf } from './score';
