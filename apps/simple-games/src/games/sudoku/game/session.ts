/**
 * SudokuSession — a pure, immutable snapshot of one game in progress: board +
 * undo history + counters. The React layer only dispatches into these
 * functions; all rules live here and in engine.ts.
 *
 * Undo restores the board but never the mistake or hint counters (§4): a wrong
 * digit was still entered, and a hint was still taken. There is no score and
 * no clock on screen; elapsed seconds are carried for the clear screen and the
 * statistics only (§12).
 */
import { dailySeed, DAILY_DIFFICULTY } from './daily';
import { createBoard, isSolved, place, erase, toggleNote, type Board } from './engine';
import { generatePuzzle } from './generator';
import { difficultyForLevel, levelSeed } from './levels';
import type { Difficulty, Digit, GameMode, GameStatus, Grid } from './types';

/** Practically unlimited undo; a real game never comes close (§4). */
export const UNDO_HISTORY_LIMIT = 2000;

export interface SudokuSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for the daily and for free play. */
  readonly level: number | null;
  readonly board: Board;
  /** The one solution the puzzle admits — what a mistake is measured against. */
  readonly solution: Grid;
  /** Board snapshots before each change. */
  readonly history: readonly Board[];
  readonly status: GameStatus;
  readonly mistakeCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
  level: number | null,
  givens: Grid,
  solution: Grid,
): SudokuSession {
  const board = createBoard(givens);
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    level,
    board,
    solution,
    history: [],
    status: isSolved(board) ? 'solved' : 'playing',
    mistakeCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level. */
export function createLevelSession(level: number): SudokuSession {
  const difficulty = difficultyForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, difficulty);
  return baseSession('level', seed, difficulty, null, level, puzzle.givens, puzzle.solution);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): SudokuSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_DIFFICULTY);
  return baseSession(
    'daily',
    seed,
    DAILY_DIFFICULTY,
    dateString,
    null,
    puzzle.givens,
    puzzle.solution,
  );
}

/**
 * A token that makes one free board's seed its own (§9「フリープレイ」). Free
 * play has no level number and no date to seed from, so a new game gets a
 * new board — while the seed still pins that board down completely, which is
 * what makes "retry the same board" exact and the saved game restorable.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (token: string): string => `sudoku-free-${token}`;

/** A fresh free board at a chosen tier — new unless a seed pins an old one. */
export function createFreeSession(
  difficulty: Difficulty,
  seed: string = freeSeed(newSeedToken()),
): SudokuSession {
  const puzzle = generatePuzzle(seed, difficulty);
  return baseSession('free', seed, difficulty, null, null, puzzle.givens, puzzle.solution);
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: SudokuSession): SudokuSession {
  if (session.mode === 'level' && session.level !== null) return createLevelSession(session.level);
  if (session.mode === 'daily') return createDailySession(session.dailyDate ?? '');
  return createFreeSession(session.difficulty, session.seed);
}

/** Restores a session from persisted state (undo history is not persisted). */
export function restoreSession(data: Omit<SudokuSession, 'history' | 'status'>): SudokuSession {
  return {
    ...data,
    history: [],
    status: isSolved(data.board) ? 'solved' : 'playing',
  };
}

function pushHistory(session: SudokuSession): readonly Board[] {
  const next = [...session.history, session.board];
  if (next.length > UNDO_HISTORY_LIMIT) next.shift();
  return next;
}

function withBoard(session: SudokuSession, board: Board): SudokuSession {
  return {
    ...session,
    board,
    history: pushHistory(session),
    status: isSolved(board) ? 'solved' : 'playing',
  };
}

/**
 * Writes a digit. Returns null when the move is not allowed (a clue cell, or
 * the same digit already there). A wrong digit is allowed and counted — the
 * game never blocks a move or ends because of one (§4).
 */
export function placeDigit(
  session: SudokuSession,
  index: number,
  digit: Digit,
): SudokuSession | null {
  if (session.status !== 'playing') return null;
  const result = place(session.board, index, digit, session.solution);
  if (result === null) return null;
  const next = withBoard(session, result.board);
  return result.mistake ? { ...next, mistakeCount: next.mistakeCount + 1 } : next;
}

/** Clears a player entry (and its notes). Returns null when there is nothing to clear. */
export function eraseCell(session: SudokuSession, index: number): SudokuSession | null {
  if (session.status !== 'playing') return null;
  const board = erase(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/** Adds or removes one note digit. Returns null when notes are not allowed there. */
export function toggleCellNote(
  session: SudokuSession,
  index: number,
  digit: Digit,
): SudokuSession | null {
  if (session.status !== 'playing') return null;
  const board = toggleNote(session.board, index, digit);
  return board === null ? null : withBoard(session, board);
}

export function canUndo(session: SudokuSession): boolean {
  return session.history.length > 0;
}

/**
 * Reverts the last board change. Mistake and hint counts stay where they are:
 * undo takes back a move, not the fact that it was made (§4).
 */
export function undo(session: SudokuSession): SudokuSession | null {
  const previous = session.history[session.history.length - 1];
  if (!previous) return null;
  return {
    ...session,
    board: previous,
    history: session.history.slice(0, -1),
    status: isSolved(previous) ? 'solved' : 'playing',
  };
}

export function countHintUse(session: SudokuSession): SudokuSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
