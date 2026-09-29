/**
 * Sudoku6x6Session — a pure, immutable snapshot of one game in progress:
 * board + undo history + counters. The React layer only dispatches into these
 * functions; the rules live here and in engine.ts.
 *
 * Undo restores the board but never the mistake or hint counters (§4): a
 * wrong digit was still entered, and a hint was still taken. There is no score
 * and no clock on screen; elapsed seconds are carried in by whoever owns the
 * timer, for the result card and the statistics only (§10).
 */
import { DAILY_DIFFICULTY, dailySeed } from './daily';
import { createBoard, erase, isSolved, place, toggleNote, type Board } from './engine';
import { generatePuzzle } from './generator';
import { findHint, type Hint } from './hint';
import type { Difficulty, Digit, GameMode, GameStatus, Grid } from './types';

/** Practically unlimited undo; a real game never comes close (§4). */
export const UNDO_HISTORY_LIMIT = 2000;

export interface Sudoku6x6Session {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD for the daily, null otherwise. */
  readonly dailyDate: string | null;
  readonly board: Board;
  /** The one solution the puzzle admits — what a mistake is measured against (§4). */
  readonly solution: Grid;
  /** Board snapshots before each change. Never saved (§11). */
  readonly history: readonly Board[];
  readonly status: GameStatus;
  readonly mistakeCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one difficulty game's seed its own (§9). There are no
 * levels and no dates to seed from, so a new game gets a new board — while
 * the seed still pins that board down completely, which is what makes "retry
 * the same board" exact and a save restorable.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `sudoku-6x6-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): Sudoku6x6Session {
  const puzzle = generatePuzzle(seed, difficulty);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    board: createBoard(puzzle.givens),
    solution: puzzle.solution,
    history: [],
    status: 'playing',
    mistakeCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh difficulty game — new unless a seed pins an old one (§9). */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): Sudoku6x6Session {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§9). */
export function createDailySession(dateString: string): Sudoku6x6Session {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

/** Rebuilds the same puzzle from scratch (Retry): same seed, same board, clean slate. */
export function restartSession(session: Sudoku6x6Session): Sudoku6x6Session {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    return createDailySession(session.dailyDate);
  }
  return createDifficultySession(session.difficulty, session.seed);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored: a saved status is one more thing that can be
 * wrong, and §2 is cheap to evaluate. Undo history is never persisted (§11).
 */
export function restoreSession(
  data: Omit<Sudoku6x6Session, 'history' | 'status'>,
): Sudoku6x6Session {
  return { ...data, history: [], status: isSolved(data.board) ? 'solved' : 'playing' };
}

function pushHistory(session: Sudoku6x6Session): readonly Board[] {
  const next = [...session.history, session.board];
  if (next.length > UNDO_HISTORY_LIMIT) next.shift();
  return next;
}

function withBoard(session: Sudoku6x6Session, board: Board): Sudoku6x6Session {
  return {
    ...session,
    board,
    history: pushHistory(session),
    status: isSolved(board) ? 'solved' : 'playing',
  };
}

/**
 * Writes a digit. Null when the move is not allowed (a clue cell, the same
 * digit already there, or a finished board). A wrong digit is allowed and
 * counted — the game never blocks a move or ends because of one (§4).
 *
 * Refusing every move once solved is what makes the transition into it
 * happen exactly once, so the caller can book the completion on that edge.
 */
export function placeDigit(
  session: Sudoku6x6Session,
  index: number,
  digit: Digit,
): Sudoku6x6Session | null {
  if (session.status !== 'playing') return null;
  const result = place(session.board, index, digit, session.solution);
  if (result === null) return null;
  const next = withBoard(session, result.board);
  return result.mistake ? { ...next, mistakeCount: next.mistakeCount + 1 } : next;
}

/** Clears a player entry (and its notes). Null when there is nothing to clear. */
export function eraseCell(session: Sudoku6x6Session, index: number): Sudoku6x6Session | null {
  if (session.status !== 'playing') return null;
  const board = erase(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/** Adds or removes one note digit. Null when notes are not allowed there. */
export function toggleCellNote(
  session: Sudoku6x6Session,
  index: number,
  digit: Digit,
): Sudoku6x6Session | null {
  if (session.status !== 'playing') return null;
  const board = toggleNote(session.board, index, digit);
  return board === null ? null : withBoard(session, board);
}

export const canUndo = (session: Sudoku6x6Session): boolean => session.history.length > 0;

/**
 * Reverts the last board change. Mistake and hint counts stay where they are:
 * undo takes back a move, not the fact that it was made (§4).
 */
export function undo(session: Sudoku6x6Session): Sudoku6x6Session | null {
  if (session.status !== 'playing') return null;
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous,
    history: session.history.slice(0, -1),
    status: isSolved(previous) ? 'solved' : 'playing',
  };
}

/** The hint of §5 for the board on screen. It never writes a digit. */
export function hintFor(session: Sudoku6x6Session): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.board);
}

/** Hints are counted for the result card, never limited or charged for (§5). */
export function countHintUse(session: Sudoku6x6Session): Sudoku6x6Session {
  return { ...session, hintCount: session.hintCount + 1 };
}

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result card (§10). Seconds only ever move forward.
 */
export function withElapsedSeconds(session: Sudoku6x6Session, seconds: number): Sudoku6x6Session {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
