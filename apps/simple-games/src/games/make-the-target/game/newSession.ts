/**
 * A new problem for the session layer (docs/MAKE_THE_TARGET_RULES.md §5, §6,
 * §8): the only module outside the generator that imports it, and the only
 * door the state layer has to it. Both functions search (within the
 * generator's work bound) and are called on a tap only —「新しい問題」and
 * opening the day's daily (§6「探索の走るとき」). Resuming, retrying and
 * revealing never come here.
 *
 * Not re-exported by the barrel (index.ts): the state layer imports it by
 * name, so nothing reaches the generator by accident.
 */
import { DAILY_DIFFICULTY } from './daily';
import { generateProblem, type GeneratedProblem } from './generator';
import {
  createSession,
  dailyOrigin,
  freeOrigin,
  freeSeed,
  type MakeTheTargetSession,
} from './session';
import type { Difficulty } from './types';

export interface NewSession {
  readonly session: MakeTheTargetSession;
  /** What generation reported — `fallback`, `work`, `attempts` — for measuring, never shown. */
  readonly generated: GeneratedProblem;
}

/**
 * A new Free Play problem (§8) for `token` — `newSeedToken(Date.now(),
 * Math.random)`, which is never empty. An empty token throws: its seed is
 * not a Free Play seed (`isFreeSeed`), so the game's save would be refused
 * on load (§10) — a caller's bug, not something to play on.
 */
export function newFreeSession(difficulty: Difficulty, token: string): NewSession {
  if (token.length === 0) throw new RangeError('newFreeSession: empty seed token');
  const seed = freeSeed(difficulty, token);
  const generated = generateProblem(seed, difficulty);
  return { session: createSession(generated.problem, freeOrigin(seed)), generated };
}

/** The daily for a local YYYY-MM-DD date (§8): Medium, from the date's seed. */
export function newDailySession(dateString: string): NewSession {
  const origin = dailyOrigin(dateString);
  const generated = generateProblem(origin.seed, DAILY_DIFFICULTY);
  return { session: createSession(generated.problem, origin), generated };
}
