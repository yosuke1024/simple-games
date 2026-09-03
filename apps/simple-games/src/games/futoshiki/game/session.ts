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
import { FREE_TIER_LEVEL, levelSeed, sizeForLevel, specForLevel, type FreeTier } from './levels';
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
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for the daily and for free play. */
  readonly level: number | null;
  /**
   * The tier a free board was drawn at (§9「フリープレイ」), null otherwise.
   * The seed pins the board; the tier says which level's parameters it was
   * drawn with, which is what a restart from the same seed has to know.
   */
  readonly freeTier: FreeTier | null;
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

/** What names a session before its board exists: the mode, and where it came from. */
type Identity = Pick<
  FutoshikiSession,
  'mode' | 'seed' | 'size' | 'dailyDate' | 'level' | 'freeTier'
>;

function baseSession(
  identity: Identity,
  puzzle: ReturnType<typeof generatePuzzle>,
): FutoshikiSession {
  return {
    ...identity,
    solution: puzzle.solution,
    constraints: puzzle.constraints,
    board: createBoard(puzzle.givens),
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
  return baseSession(
    { mode: 'level', seed, size, dailyDate: null, level, freeTier: null },
    generatePuzzle(seed, size, specForLevel(level)),
  );
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§9). */
export function createDailySession(dateString: string): FutoshikiSession {
  const seed = dailySeed(dateString);
  return baseSession(
    { mode: 'daily', seed, size: DAILY_SIZE, dailyDate: dateString, level: null, freeTier: null },
    generatePuzzle(seed, DAILY_SIZE, DAILY_SPEC),
  );
}

/**
 * A token that makes one free board's seed its own (§9「フリープレイ」). Free
 * play has no level number and no date to seed from, so a new game gets a new
 * board — while the seed still pins that board down completely, which is what
 * makes "retry the same board" exact and the saved game restorable.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const freeSeed = (token: string): string => `futoshiki-free-${token}`;

/**
 * A fresh free board at a chosen tier — new unless a seed pins an old one. The
 * tier is a representative level's parameters (§9): the size, sign count and
 * givens count of level 10, 50 or 95, with a seed of its own.
 */
export function createFreeSession(
  tier: FreeTier,
  seed: string = freeSeed(newSeedToken()),
): FutoshikiSession {
  const level = FREE_TIER_LEVEL[tier];
  const size = sizeForLevel(level);
  return baseSession(
    { mode: 'free', seed, size, dailyDate: null, level: null, freeTier: tier },
    generatePuzzle(seed, size, specForLevel(level)),
  );
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: FutoshikiSession): FutoshikiSession {
  if (session.mode === 'level' && session.level !== null) return createLevelSession(session.level);
  if (session.mode === 'free' && session.freeTier !== null) {
    return createFreeSession(session.freeTier, session.seed);
  }
  return createDailySession(session.dailyDate ?? '');
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
