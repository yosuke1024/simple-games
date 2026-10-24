/**
 * Hand-built problems for the storage, state and screen tests
 * (docs/MAKE_THE_TARGET_RULES.md §15). They are built with the session's own
 * functions over problems written out here, never by the generator — the
 * layers above game/ may not import it (game/searchBoundary.test.ts), and a
 * problem the test spells out is one whose every move it knows.
 *
 * `PROBLEM` is 1, 2, 3, 4 → 21: (1 + 2) × (3 + 4). Its shape is one every tier
 * but Hard deals (4 numbers from 1–10, a target in Easy's and Medium's band);
 * the load path checks the shape, never the tier's `ways` band (§10).
 */
import {
  createSession,
  dailyOrigin,
  freeOrigin,
  freeSeed,
  tapOperator,
  tapTile,
  toRecord,
  type Difficulty,
  type MakeTheTargetSession,
  type Operator,
  type Problem,
} from '../game';

export const PROBLEM_NUMBERS = [1, 2, 3, 4] as const;
export const PROBLEM_TARGET = 21;

/** The problem at a difficulty whose shape it fits (Easy or Medium). */
export const problemAt = (difficulty: Difficulty = 'easy'): Problem => ({
  difficulty,
  numbers: [...PROBLEM_NUMBERS],
  target: PROBLEM_TARGET,
  solution: [
    { left: 0, op: '+', right: 1 },
    { left: 2, op: '+', right: 3 },
    { left: 1, op: '*', right: 3 },
  ],
});

export const FREE_TOKEN = 'lq1x2-abc';
export const SAVED_AT = 1_790_000_000_000;

/** A fresh Free Play game on the problem. */
export const freeGame = (
  difficulty: Difficulty = 'easy',
  token = FREE_TOKEN,
): MakeTheTargetSession =>
  createSession(problemAt(difficulty), freeOrigin(freeSeed(difficulty, token)));

/** A fresh daily for `date` on the problem (dailies are Medium, §8). */
export const dailyGame = (date: string): MakeTheTargetSession =>
  createSession(problemAt('medium'), dailyOrigin(date));

/** Taps, in order: a number is a tile's slot, a sign an operator. */
export function play(
  session: MakeTheTargetSession,
  ...steps: (number | Operator)[]
): MakeTheTargetSession {
  return steps.reduce<MakeTheTargetSession>(
    (s, step) => (typeof step === 'number' ? tapTile(s, step) : tapOperator(s, step)),
    session,
  );
}

/** The kept solution, tapped: solved. */
export const SOLVE: readonly (number | Operator)[] = [0, '+', 1, 2, '+', 3, 1, '*', 3];
/** Three legal moves that end on 10, not 21: `missed`. */
export const MISS: readonly (number | Operator)[] = [0, '+', 1, 1, '+', 2, 2, '+', 3];

/** The record a save writes for `session`, as the device store holds it. */
export const storedRecord = (session: MakeTheTargetSession, savedAt = SAVED_AT): string =>
  JSON.stringify(toRecord(session, savedAt));
