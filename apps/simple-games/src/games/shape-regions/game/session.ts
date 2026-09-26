/**
 * ShapeRegionsSession — a pure, immutable snapshot of one puzzle: the clues,
 * the answer, what the player has assigned, the undo history, and the
 * counters kept for the result screen.
 *
 * Undo exists here (§6) because one tap can take several cells away at once —
 * the cell and everything it cut off from the clue — and putting them back
 * means growing the region again cell by cell. One stroke or one tap is one
 * step; the history lives on the session and is never persisted (§11).
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§9).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import {
  addCells,
  findViolations,
  initialAssignment,
  isSolved,
  removeCell,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { findHint, type Hint } from './solver';
import type { Assignment, Clue, Difficulty, GameMode, GameStatus } from './types';

/**
 * How many steps back the player can go. A real game never comes close; the
 * cap exists so a session that somehow runs forever cannot grow without bound.
 */
export const UNDO_HISTORY_LIMIT = 200;

export interface ShapeRegionsSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly width: number;
  readonly height: number;
  readonly clues: readonly Clue[];
  /** The one answer: region index per cell (§3, §8). */
  readonly solution: readonly number[];
  /** What the player has assigned: region index or UNASSIGNED per cell. */
  readonly assignment: Assignment;
  /** Assignments before each step. Not persisted (§11). */
  readonly history: readonly Assignment[];
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has
 * no levels and no dates to seed from (§9), so a new game gets a new board —
 * while the seed still pins that board down completely, which is what lets
 * the retry offer the same board back for free.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `shape-regions-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): ShapeRegionsSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    width: puzzle.width,
    height: puzzle.height,
    clues: puzzle.clues,
    solution: puzzle.solution,
    assignment: initialAssignment(puzzle),
    history: [],
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§9). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): ShapeRegionsSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§9). */
export function createDailySession(dateString: string): ShapeRegionsSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** Rebuilds the same puzzle from scratch (Retry): same seed, clean board. */
export function restartSession(session: ShapeRegionsSession): ShapeRegionsSession {
  return session.mode === 'daily' && session.dailyDate !== null
    ? createDailySession(session.dailyDate)
    : createDifficultySession(session.difficulty, session.seed);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more
 * thing that can be wrong, and §3 is cheap to evaluate. History starts empty.
 */
export function restoreSession(
  data: Omit<ShapeRegionsSession, 'history' | 'status'>,
): ShapeRegionsSession {
  return {
    ...data,
    history: [],
    status: isSolved(data, data.assignment) ? 'solved' : 'playing',
  };
}

/** What is currently broken, for the always-on violation display (§5). */
export const violationsOf = (session: ShapeRegionsSession): Violations =>
  findViolations(session, session.assignment);

function withAssignment(
  session: ShapeRegionsSession,
  assignment: readonly number[],
  newStep: boolean,
): ShapeRegionsSession {
  let history = session.history;
  if (newStep) {
    history = [...history, session.assignment];
    if (history.length > UNDO_HISTORY_LIMIT) history = history.slice(1);
  }
  return {
    ...session,
    assignment,
    history,
    status: isSolved(session, assignment) ? 'solved' : 'playing',
  };
}

/**
 * The cells a stroke crossed, offered to a region (§4). `extend` is true for
 * every move after the first that wrote something in the same stroke: the
 * step was opened by the first one, so nothing new goes on the history.
 * Returns null when no cell joined — nothing to undo, nothing to redraw.
 *
 * Refusing every move once the status is 'solved' is what makes the
 * transition into it happen exactly once: there is no path from solved back
 * to playing — not even by undo — so the caller can book the completion on
 * the edge and never again.
 */
export function doStroke(
  session: ShapeRegionsSession,
  region: number,
  cells: readonly number[],
  extend = false,
): ShapeRegionsSession | null {
  if (session.status !== 'playing') return null;
  const next = addCells(session.assignment, session, region, cells);
  return next === null ? null : withAssignment(session, next, !extend);
}

/** One tap on a region's cell (§4). Null when nothing leaves. */
export function doRemove(session: ShapeRegionsSession, index: number): ShapeRegionsSession | null {
  if (session.status !== 'playing') return null;
  const next = removeCell(session.assignment, session, index);
  return next === null ? null : withAssignment(session, next, true);
}

export const canUndo = (session: ShapeRegionsSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/** Reverts the last stroke or tap (§6). The hint count stays where it is. */
export function doUndo(session: ShapeRegionsSession): ShapeRegionsSession | null {
  if (!canUndo(session)) return null;
  const previous = session.history[session.history.length - 1]!;
  return { ...session, assignment: previous, history: session.history.slice(0, -1) };
}

/**
 * The hint of §6 — the region that disagrees with the answer, else the next
 * deduction the techniques prove from the player's own board. Free and
 * unlimited; never writes to the board.
 */
export function hintFor(session: ShapeRegionsSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session, session.solution, session.assignment);
}

/** Hints are counted for the result screen, never limited or charged for. */
export const doHintUse = (session: ShapeRegionsSession): ShapeRegionsSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(
  session: ShapeRegionsSession,
  seconds: number,
): ShapeRegionsSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
