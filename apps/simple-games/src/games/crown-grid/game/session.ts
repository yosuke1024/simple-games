/**
 * CrownGridSession — a pure, immutable snapshot of one puzzle: the regions,
 * the hidden answer, what the player has marked, and the counters kept for
 * the result screen.
 *
 * There is deliberately no undo and no history to hold one (§14): every cell
 * cycles empty → × → crown → empty under the same tap, so every move already
 * is its own undo, and a stroke only ever adds ×s the same tap takes off. The
 * help this game offers is the hint (§6), exposed here as `hintFor`.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§9).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  cycleCell,
  emptyMarks,
  findViolations,
  isSolved,
  markCross,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { findHint, type Hint } from './solver';
import {
  SIZE_FOR,
  type Difficulty,
  type GameMode,
  type GameStatus,
  type Mark,
  type Size,
} from './types';

export interface CrownGridSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  readonly size: Size;
  /** One region id per cell (§1). */
  readonly regions: readonly number[];
  /** The crown's column in each row (§8). Never compared against for the win (§2). */
  readonly solution: readonly number[];
  /** What the player has marked (§1). */
  readonly marks: readonly Mark[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one difficulty game's seed its own (§9). Difficulty
 * mode has no levels and no dates to seed from, so a new game gets a new
 * board — while the seed still pins that board down completely, which is
 * what lets a retry offer the same board back and a save restore exactly.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `crown-grid-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): CrownGridSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    size: puzzle.size,
    regions: puzzle.regions,
    solution: puzzle.solution,
    marks: emptyMarks(puzzle.size),
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§9). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): CrownGridSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§9). */
export function createDailySession(dateString: string): CrownGridSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** Rebuilds the same puzzle from scratch (Retry): same seed, same board, clean marks. */
export function restartSession(session: CrownGridSession): CrownGridSession {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return createDailySession(session.dailyDate);
  }
  return createDifficultySession(session.difficulty, session.seed);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 */
export function restoreSession(data: Omit<CrownGridSession, 'status'>): CrownGridSession {
  return {
    ...data,
    status: isSolved(data.marks, data.regions, data.size) ? 'solved' : 'playing',
  };
}

/** What is currently broken, for the always-on violation display (§5). */
export function violationsOf(session: CrownGridSession): Violations {
  return findViolations(session.marks, session.regions, session.size);
}

function withMarks(session: CrownGridSession, marks: Mark[]): CrownGridSession {
  return {
    ...session,
    marks,
    status: isSolved(marks, session.regions, session.size) ? 'solved' : 'playing',
  };
}

/**
 * One tap: empty → × → crown → empty (§4). Returns null when nothing changes —
 * an index off the board, or a puzzle already solved.
 *
 * Refusing every move once the status is 'solved' is what makes the transition
 * into it happen exactly once: there is no path from solved back to playing,
 * so the caller can book the completion on the edge and never again.
 */
export function doTap(session: CrownGridSession, index: number): CrownGridSession | null {
  if (session.status !== 'playing') return null;
  const marks = cycleCell(session.marks, index);
  return marks === null ? null : withMarks(session, marks);
}

/**
 * One stroke: × onto every listed cell that is still empty (§4). Null when
 * nothing changed — every cell already held something, or the puzzle is over.
 * A stroke can never finish a board: it only ever adds ×s.
 */
export function doMarkCross(
  session: CrownGridSession,
  indices: readonly number[],
): CrownGridSession | null {
  if (session.status !== 'playing') return null;
  const marks = markCross(session.marks, indices);
  return marks === null ? null : withMarks(session, marks);
}

/**
 * The teaching hint of §6 — a broken rule, a crown that cannot be right, or
 * the next technique step read from the player's crowns. Free and unlimited.
 */
export function hintFor(session: CrownGridSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.marks, session.regions, session.solution, session.size);
}

/** Hints are counted for the result screen, never limited or charged for. */
export function doHintUse(session: CrownGridSession): CrownGridSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(session: CrownGridSession, seconds: number): CrownGridSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}

/** The board size a difficulty plays at (§1), for callers that only hold the difficulty. */
export const sizeOf = (difficulty: Difficulty): Size => SIZE_FOR[difficulty];
