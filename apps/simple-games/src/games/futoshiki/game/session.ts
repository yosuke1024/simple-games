/**
 * FutoshikiSession — a pure, immutable snapshot of one puzzle: the answer, the
 * signs, the board the player is working on, the undo history, and the
 * counters kept for the result screen.
 *
 * The clock lives outside. Elapsed seconds are carried in by whoever owns the
 * timer and handed back out for the result screen and the statistics — this
 * layer never reads one, which is what keeps a session a pure function of its
 * seed (§8, §10).
 *
 * Undo restores the board and nothing else (§5): a wrong digit was still
 * entered and a hint was still taken, so neither counter moves. The history is
 * never persisted — a resumed game starts with an empty stack (§11), because
 * a stack of boards is the largest thing in the record and the one thing
 * nobody misses.
 */
import { DAILY_SIZE, DAILY_SPEC, dailySeed } from './daily';
import {
  createBoard,
  erase,
  isSolved,
  mistakenCells,
  place,
  remainingForDigit,
  findViolations,
  toGrid,
  toggleNote,
  type Board,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { levelSeed, sizeForLevel, specForLevel } from './levels';
import { findHint, type Hint } from './solver';
import type { Constraint, Digit, GameMode, GameStatus, Size } from './types';

/**
 * Practically unlimited undo; a real game never comes close (§5). The cap
 * exists so a session that somehow runs forever cannot grow without bound.
 */
export const UNDO_HISTORY_LIMIT = 2000;

export interface FutoshikiSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  /** The one answer the puzzle admits — what a mistake is measured against. */
  readonly solution: readonly number[];
  /** The signs, in reading order (§1). A hint names one by its position here. */
  readonly constraints: readonly Constraint[];
  readonly board: Board;
  /** Board snapshots before each change. Not persisted (§11). */
  readonly history: readonly Board[];
  readonly status: GameStatus;
  readonly mistakeCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

/** The board as one grid — the givens with the player's digits over them. */
export const gridOf = (session: FutoshikiSession): number[] => toGrid(session.board);

/** What is currently broken, for the always-on violation display (§5). */
export const violationsOf = (session: FutoshikiSession): Violations =>
  findViolations(gridOf(session), session.size, session.constraints);

/**
 * Entries that disagree with the answer (§5). Shown only when the player has
 * that setting on — this layer computes it, the state layer decides.
 */
export const mistakesOf = (session: FutoshikiSession): ReadonlySet<number> =>
  mistakenCells(session.board, session.solution);

/** How many of a digit are still to be placed — the pad's counter (§4). */
export const remainingOf = (session: FutoshikiSession, digit: Digit): number =>
  remainingForDigit(session.board, session.size, digit);

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  dailyDate: string | null,
  level: number | null,
  solution: readonly number[],
  constraints: readonly Constraint[],
  givens: readonly number[],
): FutoshikiSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    solution,
    constraints,
    board: createBoard(givens),
    history: [],
    status: 'playing',
    mistakeCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level (§9). */
export function createLevelSession(level: number): FutoshikiSession {
  const size = sizeForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, size, specForLevel(level));
  return baseSession(
    'level',
    seed,
    size,
    null,
    level,
    puzzle.solution,
    puzzle.constraints,
    puzzle.givens,
  );
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§9). */
export function createDailySession(dateString: string): FutoshikiSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_SPEC);
  return baseSession(
    'daily',
    seed,
    DAILY_SIZE,
    dateString,
    null,
    puzzle.solution,
    puzzle.constraints,
    puzzle.givens,
  );
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: FutoshikiSession): FutoshikiSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 */
export function restoreSession(
  data: Omit<FutoshikiSession, 'history' | 'status'>,
): FutoshikiSession {
  return {
    ...data,
    history: [],
    status: isSolved(toGrid(data.board), data.size, data.constraints) ? 'solved' : 'playing',
  };
}

function withBoard(session: FutoshikiSession, board: Board): FutoshikiSession {
  const history = [...session.history, session.board];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();
  return {
    ...session,
    board,
    history,
    status: isSolved(toGrid(board), session.size, session.constraints) ? 'solved' : 'playing',
  };
}

/**
 * Writes a digit (§4). Returns null when the move changes nothing — a given
 * cell, the same digit already there, or a puzzle already solved.
 *
 * A wrong digit is allowed and counted; the game never blocks a move and never
 * ends because of one (§5).
 *
 * Refusing every move once the status is 'solved' is what makes the transition
 * into it happen exactly once: there is no path from solved back to playing —
 * not even by undo — so the caller can book the completion on the edge and
 * never again.
 */
export function doPlace(
  session: FutoshikiSession,
  index: number,
  digit: Digit,
): FutoshikiSession | null {
  if (session.status !== 'playing') return null;
  if (digit < 1 || digit > session.size) return null;
  const result = place(session.board, session.size, index, digit, session.solution);
  if (result === null) return null;
  const next = withBoard(session, result.board);
  return result.mistake ? { ...next, mistakeCount: next.mistakeCount + 1 } : next;
}

/** Clears a player entry and its notes. Null when there is nothing to clear. */
export function doErase(session: FutoshikiSession, index: number): FutoshikiSession | null {
  if (session.status !== 'playing') return null;
  const board = erase(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/** Adds or removes one note digit. Null when a note is not allowed there (§4). */
export function doToggleNote(
  session: FutoshikiSession,
  index: number,
  digit: Digit,
): FutoshikiSession | null {
  if (session.status !== 'playing') return null;
  if (digit < 1 || digit > session.size) return null;
  const board = toggleNote(session.board, index, digit);
  return board === null ? null : withBoard(session, board);
}

export const canUndo = (session: FutoshikiSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/**
 * Reverts the last board change (§5). Mistake and hint counts stay where they
 * are: undo takes back a move, not the fact that it was made.
 *
 * Unlike Takuzu, this game has an undo at all, and for Sudoku's reason: a
 * digit erases the notes of its whole row and column (§4), so a move here is
 * non-obviously irreversible and no amount of tapping brings those pencil
 * marks back.
 */
export function doUndo(session: FutoshikiSession): FutoshikiSession | null {
  if (!canUndo(session)) return null;
  const previous = session.history[session.history.length - 1]!;
  return { ...session, board: previous, history: session.history.slice(0, -1) };
}

/**
 * The teaching hint of §6 — the next thing the techniques settle on the
 * player's own board, or the break the board already has. Free and unlimited;
 * never a lookup into the solution.
 */
export function hintFor(session: FutoshikiSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(gridOf(session), session.size, session.constraints);
}

/** Hints are counted for the result screen, never limited or charged for (§6). */
export const doHintUse = (session: FutoshikiSession): FutoshikiSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(session: FutoshikiSession, seconds: number): FutoshikiSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
