/**
 * BinaryBalanceSession — a pure, immutable snapshot of one puzzle: the
 * solution, the givens, the links, what the player has written, and the
 * counters kept for the result screen.
 *
 * There is deliberately no undo and no history to hold one (§8): every cell
 * cycles empty → circle → square → empty under the same tap, so every move
 * already is its own undo. The help this game offers is the hint (§8),
 * exposed here as `hintFor`.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§10).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  cycleCell,
  emptyMarks,
  findViolations,
  isSolved,
  mergeBoard,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { findHint, type Hint } from './solver';
import type { Cell, Difficulty, GameMode, GameStatus, Link, Mark, Size } from './types';

export interface BinaryBalanceSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  readonly size: Size;
  /** The one answer (§5). Never compared against for the win (§2). */
  readonly solution: readonly Cell[];
  /** The fixed cells (§1). EMPTY wherever the player has to work it out. */
  readonly givens: readonly Mark[];
  /** The `=` / `×` links (§1). Never empty. */
  readonly links: readonly Link[];
  /** What the player has written. Always EMPTY where a given sits (§11). */
  readonly marks: readonly Mark[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one difficulty game's seed its own (§10). A new game gets
 * a new board, while the seed still pins that board down completely — which
 * is what lets Retry offer the same board back and a save restore exactly.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `binary-balance-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): BinaryBalanceSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    size: puzzle.size,
    solution: puzzle.solution,
    givens: puzzle.givens,
    links: puzzle.links,
    marks: emptyMarks(puzzle.size),
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§10). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): BinaryBalanceSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§10). */
export function createDailySession(dateString: string): BinaryBalanceSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** Rebuilds the same puzzle from scratch (Retry): same seed, same board, clean marks. */
export function restartSession(session: BinaryBalanceSession): BinaryBalanceSession {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return createDailySession(session.dailyDate);
  }
  return createDifficultySession(session.difficulty, session.seed);
}

/** The board as it reads on screen — the givens with the player's marks over. */
export function boardOf(session: BinaryBalanceSession): Mark[] {
  return mergeBoard(session.givens, session.marks);
}

/** What is currently broken, for the always-on violation display (§9). */
export function violationsOf(session: BinaryBalanceSession): Violations {
  return findViolations(boardOf(session), session.links, session.size);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 */
export function restoreSession(data: Omit<BinaryBalanceSession, 'status'>): BinaryBalanceSession {
  const board = mergeBoard(data.givens, data.marks);
  return { ...data, status: isSolved(board, data.links, data.size) ? 'solved' : 'playing' };
}

/**
 * One tap: empty → circle → square → empty (§4). Returns null when nothing
 * changes — an index out of range, a given, or a puzzle already solved.
 *
 * Refusing every move once the status is 'solved' is what makes the transition
 * into it happen exactly once, so the caller can book the completion on the
 * edge and never again.
 */
export function doTap(session: BinaryBalanceSession, index: number): BinaryBalanceSession | null {
  if (session.status !== 'playing') return null;
  const marks = cycleCell(session.givens, session.marks, index);
  if (marks === null) return null;
  const board = mergeBoard(session.givens, marks);
  return {
    ...session,
    marks,
    status: isSolved(board, session.links, session.size) ? 'solved' : 'playing',
  };
}

/**
 * The teaching hint of §8 — a broken rule, a mark that cannot be right, or the
 * next technique step. Free and unlimited; it never writes a mark.
 */
export function hintFor(session: BinaryBalanceSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.givens, session.marks, session.links, session.solution, session.size);
}

/** Hints are counted for the result screen, never limited or charged for. */
export function doHintUse(session: BinaryBalanceSession): BinaryBalanceSession {
  return { ...session, hintCount: session.hintCount + 1 };
}

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(
  session: BinaryBalanceSession,
  seconds: number,
): BinaryBalanceSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
