/**
 * The suspended-game record of docs/MAKE_THE_TARGET_RULES.md §10 — what
 * `tg.saveGame` / `tg.saveDaily` hold — written by `toRecord` and read back by
 * `restoreSession`.
 *
 * A record holds the problem as dealt (numbers, target, the solution kept
 * with it) and the moves made — never a board. Restoring replays both
 * through the rules (engine.ts `isLegalMove`), so a record that play could
 * not have produced cannot be restored, and a resumed game keeps its whole
 * Undo history. Nothing here searches: the work is at most n−1 moves of the
 * solution plus n−1 moves played. This module imports neither the generator,
 * the solver, the bundled table nor newSession.ts, directly or through
 * anything it imports (searchBoundary.test.ts).
 *
 * What is NOT checked here, by design (§10「確かめないこと」): the tier's
 * `ways` band and Medium's "not Easy" half (that would take the count), and
 * whether a daily is the generator's problem for its day (that would take
 * generation). Which slot a record sits in (the key ↔ `mode` match) and
 * whether a daily is today's are the storage layer's questions.
 */
import { isLocalDateString } from './daily';
import { replay } from './engine';
import { decodeMoves, encodeMoves } from './serialize';
import {
  createSession,
  dailyOrigin,
  DAILY_DIFFICULTY,
  isFreeSeed,
  playMove,
  type MakeTheTargetSession,
} from './session';
import { isDealableShape } from './tiers';
import { isDifficulty, isGameMode, type Difficulty, type GameMode, type Problem } from './types';

export const SCHEMA_VERSION = 1;
/** The largest elapsed time a record may hold (§10). */
export const ELAPSED_SECONDS_MAX = 1e9;
/** The largest `savedAt` (ms) a record may hold (§10). */
export const SAVED_AT_MAX = 1e15;

/** The record of §10, schemaVersion 1. */
export interface SessionRecord {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly dailyDate: string | null;
  readonly numbers: readonly number[];
  readonly target: number;
  readonly solution: string;
  readonly moves: string;
  readonly repeat: boolean;
  readonly elapsedSeconds: number;
  readonly savedAt: number;
}

/**
 * A reading clamped to whole numbers from 0 to `max` (§10「書く側は、受け入れ
 * られる形しか書かない」): fractions dropped, below 0 or not a number reads 0,
 * past the bound reads the bound.
 */
export function wholeInRange(value: number, max: number): number {
  if (!(value > 0)) return 0;
  return Math.min(max, Math.floor(value));
}

/**
 * What a save holds for `session` (§10), stamped `savedAtMs`; null for a
 * solved or revealed game — a finished problem is not saved (its slot is
 * cleared instead). For a session that play can reach — one newSession.ts
 * made, then moved by the session's own functions — every record this
 * writes is one `restoreSession` reads (newSession.test.ts,
 * properties.test.ts). It does not vet a session built by hand from a bad
 * origin; `createSession` with an invalid seed writes a record the reader
 * refuses.
 */
export function toRecord(session: MakeTheTargetSession, savedAtMs: number): SessionRecord | null {
  if (session.status !== 'playing' && session.status !== 'missed') return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    numbers: [...session.problem.numbers],
    target: session.problem.target,
    solution: encodeMoves(session.problem.solution),
    moves: encodeMoves(session.moves),
    repeat: session.mode === 'free' && session.repeat,
    elapsedSeconds: wholeInRange(session.elapsedSeconds, ELAPSED_SECONDS_MAX),
    savedAt: wholeInRange(savedAtMs, SAVED_AT_MAX),
  };
}

/** Why a record was refused (§10「fail-closed の条件」). */
export type RestoreRejection =
  | 'not-a-record'
  | 'bad-version'
  | 'bad-mode'
  | 'bad-seed'
  | 'bad-difficulty'
  | 'bad-daily-date'
  | 'not-dealable'
  | 'bad-solution'
  | 'bad-moves'
  | 'finished'
  | 'bad-repeat'
  | 'bad-elapsed'
  | 'bad-saved-at';

export type RestoreResult =
  | { readonly ok: true; readonly session: MakeTheTargetSession }
  | { readonly ok: false; readonly reason: RestoreRejection };

const isWholeIn = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;

const refuse = (reason: RestoreRejection): RestoreResult => ({ ok: false, reason });

/**
 * Checks a record off the disk and rebuilds its game by replaying it (§10),
 * failing closed and never throwing, whatever it is given. The checks, in
 * order: an object; `schemaVersion` 1; a mode; a non-empty seed; a
 * difficulty; the mode's own rules (daily — a real date, Medium, the date's
 * seed, `repeat` false; Free Play — no date, a Free Play seed of the
 * record's difficulty); the problem has the tier's shape; the solution
 * replays legally to the target in exactly n−1 moves; the moves replay
 * legally in at most n−1; the replay is not already solved; `repeat` is a
 * boolean; the two counters are whole numbers in range.
 *
 * Every field is read exactly once, up front, and `numbers` is copied before
 * it is checked: only those snapshots are validated and used, so an object
 * whose getters (or an array whose elements) answer differently on a second
 * read cannot pass with one value and play with another.
 */
export function checkRecord(value: unknown): RestoreResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return refuse('not-a-record');
  }
  const {
    schemaVersion,
    mode,
    seed,
    difficulty,
    dailyDate,
    numbers: storedNumbers,
    target,
    solution: storedSolution,
    moves: storedMoves,
    repeat,
    elapsedSeconds,
    savedAt,
  } = value as Partial<Record<keyof SessionRecord, unknown>>;
  const numbers: unknown = Array.isArray(storedNumbers) ? [...storedNumbers] : storedNumbers;
  if (schemaVersion !== SCHEMA_VERSION) return refuse('bad-version');
  if (!isGameMode(mode)) return refuse('bad-mode');
  if (typeof seed !== 'string' || seed.length === 0) return refuse('bad-seed');
  if (!isDifficulty(difficulty)) return refuse('bad-difficulty');
  if (mode === 'daily') {
    if (!isLocalDateString(dailyDate)) return refuse('bad-daily-date');
    if (difficulty !== DAILY_DIFFICULTY) return refuse('bad-difficulty');
    if (seed !== dailyOrigin(dailyDate).seed) return refuse('bad-seed');
    if (repeat !== false) return refuse('bad-repeat');
  } else {
    if (dailyDate !== null) return refuse('bad-daily-date');
    if (!isFreeSeed(seed, difficulty)) return refuse('bad-seed');
  }
  if (!isDealableShape(difficulty, numbers, target)) return refuse('not-dealable');
  const dealt = numbers as number[]; // the copy, already checked
  const goal = target as number;
  const steps = dealt.length - 1;

  const solution = decodeMoves(storedSolution, steps);
  if (solution === null || solution.length !== steps) return refuse('bad-solution');
  const solved = replay(dealt, solution);
  if (solved === null || solved.slots.find((v) => v !== null) !== goal) {
    return refuse('bad-solution');
  }

  const moves = decodeMoves(storedMoves, steps);
  if (moves === null) return refuse('bad-moves');
  if (typeof repeat !== 'boolean') return refuse('bad-repeat');
  if (!isWholeIn(elapsedSeconds, ELAPSED_SECONDS_MAX)) return refuse('bad-elapsed');
  if (!isWholeIn(savedAt, SAVED_AT_MAX)) return refuse('bad-saved-at');

  const problem: Problem = { difficulty, numbers: dealt, target: goal, solution };
  let session = createSession(problem, {
    mode,
    seed,
    dailyDate: mode === 'daily' ? (dailyDate as string) : null,
  });
  for (const move of moves) {
    const next = playMove(session, move);
    if (next === null) return refuse('bad-moves');
    session = next;
  }
  if (session.status === 'solved') return refuse('finished');
  return {
    ok: true,
    // `+ 0` turns a stored −0 into 0; every other accepted value is unchanged.
    session: { ...session, repeat, elapsedSeconds: elapsedSeconds + 0 },
  };
}

/** The record's game, or null when any check of `checkRecord` fails (§10). Never throws. */
export function restoreSession(value: unknown): MakeTheTargetSession | null {
  try {
    const result = checkRecord(value);
    return result.ok ? result.session : null;
  } catch {
    // A getter on a crafted object could throw; a record that throws is not one.
    return null;
  }
}
