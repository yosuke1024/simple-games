/**
 * KakuroSession — a pure, immutable snapshot of one puzzle: the layout, the
 * answer, the runs with their clues, the board the player is working on, the
 * undo history, and the counters kept for the result screen.
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
 *
 * **There is no givens field, and its absence is load-bearing.** A Kakuro
 * hands the player no digits (§1): every white cell is theirs. That is why
 * §11's corruption test is "a digit sits on a clue cell" rather than "a digit
 * sits on a given" — there is no second class of fixed digit for one to be
 * confused with.
 */
import { DAILY_SIZE, DAILY_SPEC, dailySeed } from './daily';
import {
  clueTable,
  createBoard,
  erase,
  findViolations,
  isSolved,
  mistakenCells,
  place,
  toggleNote,
  type Board,
  type Violations,
} from './engine';
import { generatePuzzle } from './generator';
import { FREE_TIER_LEVEL, levelSeed, sizeForLevel, specForLevel, type FreeTier } from './levels';
import { findHint, type Hint } from './solver';
import type { Clue, Digit, GameMode, GameStatus, Layout, RunTable, Size } from './types';

/**
 * Practically unlimited undo; a real game never comes close (§5). The cap
 * exists so a session that somehow runs forever cannot grow without bound.
 */
export const UNDO_HISTORY_LIMIT = 2000;

export interface KakuroSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null otherwise. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for the daily and for free play. */
  readonly level: number | null;
  /**
   * Free Play's tier (§9「フリープレイ」), null for a level or a daily. A
   * restart regenerates from it: the seed says which board, the tier says
   * which level's size and density it was drawn at.
   */
  readonly freeTier: FreeTier | null;
  /** Which cells the player writes in and which carry the sums (§1). */
  readonly layout: Layout;
  /** The one answer the puzzle admits — what a mistake is measured against. */
  readonly solution: readonly number[];
  /**
   * The runs with their clues. Derived from the layout and the answer, never
   * persisted and never edited (§11) — `buildRuns` is the only place in this
   * game that computes a clue, so this cannot disagree with the board.
   */
  readonly table: RunTable;
  readonly board: Board;
  /** Board snapshots before each change. Not persisted (§11). */
  readonly history: readonly Board[];
  readonly status: GameStatus;
  readonly mistakeCount: number;
  readonly hintCount: number;
  readonly elapsedSeconds: number;
}

/** What each clue cell has to draw (§1): one entry per cell, null on a white. */
export const cluesOf = (session: KakuroSession): (Clue | null)[] =>
  clueTable(session.layout, session.table);

/** What is currently broken, for the always-on violation display (§5). */
export const violationsOf = (session: KakuroSession): Violations =>
  findViolations(session.board.entries, session.table);

/**
 * Entries that disagree with the answer (§5). Shown only when the player has
 * that setting on — this layer computes it, the state layer decides.
 */
export const mistakesOf = (session: KakuroSession): ReadonlySet<number> =>
  mistakenCells(session.board, session.solution);

/**
 * The two runs a white cell belongs to, as indices into `table.runs` — what
 * §4 highlights when a cell is selected, clue cells and all. Empty for a clue
 * cell, which is not selectable in the first place.
 */
export function runsAt(session: KakuroSession, index: number): number[] {
  const row = session.table.rowRun[index];
  const col = session.table.colRun[index];
  if (row === undefined || row < 0 || col === undefined || col < 0) return [];
  return [row, col];
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  dailyDate: string | null,
  level: number | null,
  freeTier: FreeTier | null,
  layout: Layout,
  solution: readonly number[],
  table: RunTable,
): KakuroSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    freeTier,
    layout,
    solution,
    table,
    board: createBoard(layout),
    history: [],
    status: 'playing',
    mistakeCount: 0,
    hintCount: 0,
    elapsedSeconds: 0,
  };
}

/** A fresh (or restarted) level game — deterministic per level (§9). */
export function createLevelSession(level: number): KakuroSession {
  const size = sizeForLevel(level);
  const seed = levelSeed(level);
  const puzzle = generatePuzzle(seed, size, specForLevel(level));
  return baseSession(
    'level',
    seed,
    size,
    null,
    level,
    null,
    puzzle.layout,
    puzzle.solution,
    puzzle.table,
  );
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§9). */
export function createDailySession(dateString: string): KakuroSession {
  const seed = dailySeed(dateString);
  const puzzle = generatePuzzle(seed, DAILY_SIZE, DAILY_SPEC);
  return baseSession(
    'daily',
    seed,
    DAILY_SIZE,
    dateString,
    null,
    null,
    puzzle.layout,
    puzzle.solution,
    puzzle.table,
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

export const freeSeed = (token: string): string => `kakuro-free-${token}`;

/**
 * A fresh free board at a chosen tier — new unless a seed pins an old one.
 * The tier is a representative level's size and density (§9): the same
 * generation the level list has already measured, with only the seed free.
 */
export function createFreeSession(
  tier: FreeTier,
  seed: string = freeSeed(newSeedToken()),
): KakuroSession {
  const level = FREE_TIER_LEVEL[tier];
  const size = sizeForLevel(level);
  const puzzle = generatePuzzle(seed, size, specForLevel(level));
  return baseSession(
    'free',
    seed,
    size,
    null,
    null,
    tier,
    puzzle.layout,
    puzzle.solution,
    puzzle.table,
  );
}

/** Rebuilds the same puzzle from scratch (Restart). */
export function restartSession(session: KakuroSession): KakuroSession {
  if (session.mode === 'level' && session.level !== null) return createLevelSession(session.level);
  if (session.mode === 'daily') return createDailySession(session.dailyDate ?? '');
  return createFreeSession(session.freeTier ?? 'medium', session.seed);
}

/**
 * Restores a session from persisted state. The win is re-derived from the
 * board rather than restored from the record: a saved status is one more thing
 * that can be wrong, and §2 is cheap to evaluate.
 *
 * The run table comes in with the rest because `decodeGame` already rebuilt it
 * from the layout and the answer — recomputing it here would be the same sum
 * done twice, and the record it came from never carried a clue at all (§11).
 */
export function restoreSession(data: Omit<KakuroSession, 'history' | 'status'>): KakuroSession {
  return {
    ...data,
    history: [],
    status: isSolved(data.board.entries, data.table) ? 'solved' : 'playing',
  };
}

function withBoard(session: KakuroSession, board: Board): KakuroSession {
  const history = [...session.history, session.board];
  if (history.length > UNDO_HISTORY_LIMIT) history.shift();
  return {
    ...session,
    board,
    history,
    status: isSolved(board.entries, session.table) ? 'solved' : 'playing',
  };
}

/**
 * Writes a digit (§4). Returns null when the move changes nothing — a clue
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
export function doPlace(session: KakuroSession, index: number, digit: Digit): KakuroSession | null {
  if (session.status !== 'playing') return null;
  if (digit < 1 || digit > 9) return null;
  const result = place(session.board, session.table, index, digit, session.solution);
  if (result === null) return null;
  const next = withBoard(session, result.board);
  return result.mistake ? { ...next, mistakeCount: next.mistakeCount + 1 } : next;
}

/** Clears a cell and its notes. Null when there is nothing to clear. */
export function doErase(session: KakuroSession, index: number): KakuroSession | null {
  if (session.status !== 'playing') return null;
  const board = erase(session.board, session.table, index);
  return board === null ? null : withBoard(session, board);
}

/** Adds or removes one note digit. Null when a note is not allowed there (§4). */
export function doToggleNote(
  session: KakuroSession,
  index: number,
  digit: Digit,
): KakuroSession | null {
  if (session.status !== 'playing') return null;
  if (digit < 1 || digit > 9) return null;
  const board = toggleNote(session.board, session.table, index, digit);
  return board === null ? null : withBoard(session, board);
}

export const canUndo = (session: KakuroSession): boolean =>
  session.status === 'playing' && session.history.length > 0;

/**
 * Reverts the last board change (§5). Mistake and hint counts stay where they
 * are: undo takes back a move, not the fact that it was made.
 *
 * Unlike Takuzu, this game has an undo at all, and for Sudoku's reason: a
 * digit erases the notes of both of its runs (§4), so a move here is
 * non-obviously irreversible and no amount of tapping brings those pencil
 * marks back.
 */
export function doUndo(session: KakuroSession): KakuroSession | null {
  if (!canUndo(session)) return null;
  const previous = session.history[session.history.length - 1]!;
  return { ...session, board: previous, history: session.history.slice(0, -1) };
}

/**
 * The teaching hint of §6 — the next thing the techniques settle on the
 * player's own board, or the break the board already has. Free and unlimited;
 * never a lookup into the solution.
 */
export function hintFor(session: KakuroSession): Hint | null {
  if (session.status !== 'playing') return null;
  return findHint(session.board.entries, session.table);
}

/** Hints are counted for the result screen, never limited or charged for (§6). */
export const doHintUse = (session: KakuroSession): KakuroSession => ({
  ...session,
  hintCount: session.hintCount + 1,
});

/**
 * Carries the owner's running clock into the record, on the way to a save or
 * to the result screen (§10). Seconds only ever move forward, so a clock that
 * came back smaller after a restore is ignored rather than trusted.
 */
export function withElapsedSeconds(session: KakuroSession, seconds: number): KakuroSession {
  const next = Math.max(session.elapsedSeconds, Math.floor(seconds));
  return next === session.elapsedSeconds ? session : { ...session, elapsedSeconds: next };
}
