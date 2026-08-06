/**
 * MinesweeperSession — a pure, immutable snapshot of one game: the board, how
 * it was seeded, and the counters kept for the result screen.
 *
 * There is deliberately no undo and no history to hold one (§7). A board that
 * ended is replayed instead: same seed, same first tap, same mines, free and
 * immediate (§2). `restartSession` is that promise in code.
 *
 * The mines do not exist until the first tap names a cell (§4), so a session
 * starts with an empty field and `firstIndex: null`. Elapsed seconds are
 * carried for the result screen and the statistics only — never shown while
 * the game is running (§6).
 */
import { emptyField } from './board';
import { dailySeed, DAILY_DIFFICULTY } from './daily';
import { chord, createBoard, findHint, reveal, statusOf, toggleFlag, type Board } from './engine';
import { generateField } from './generator';
import type { SafeCell } from './solver';
import { PRESETS, type Difficulty, type GameMode, type GameStatus, type Preset } from './types';

export interface MinesweeperSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Local YYYY-MM-DD in daily mode, null in difficulty mode. */
  readonly dailyDate: string | null;
  readonly board: Board;
  /** The cell whose tap placed the mines, or null before the first tap (§4). */
  readonly firstIndex: number | null;
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/** True once the mines exist — i.e. once the first tap has happened (§4). */
export const hasStarted = (session: MinesweeperSession): boolean => session.firstIndex !== null;

export const presetOf = (session: MinesweeperSession): Preset => PRESETS[session.difficulty];

/**
 * A token that makes one difficulty game's seed its own. Difficulty mode has no
 * levels and no dates to seed from (§8), so a new game gets a new board — while
 * the seed still pins that board down completely, which is what lets §2 offer
 * the same board back for free.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const difficultySeed = (difficulty: Difficulty, token: string): string =>
  `mines-${difficulty}-${token}`;

function baseSession(
  mode: GameMode,
  seed: string,
  difficulty: Difficulty,
  dailyDate: string | null,
): MinesweeperSession {
  return {
    mode,
    seed,
    difficulty,
    dailyDate,
    board: createBoard(emptyField(PRESETS[difficulty])),
    firstIndex: null,
    status: 'playing',
    elapsedSeconds: 0,
    hintCount: 0,
  };
}

/** A fresh difficulty game. The seed pins the board the first tap will build. */
export function createDifficultySession(
  difficulty: Difficulty,
  seed: string = difficultySeed(difficulty, newSeedToken()),
): MinesweeperSession {
  return baseSession('difficulty', seed, difficulty, null);
}

/** A fresh daily game for a local YYYY-MM-DD date — medium every day (§8). */
export function createDailySession(dateString: string): MinesweeperSession {
  return baseSession('daily', dailySeed(dateString), DAILY_DIFFICULTY, dateString);
}

function withBoard(session: MinesweeperSession, board: Board): MinesweeperSession {
  return { ...session, board, status: statusOf(board) };
}

/**
 * Rebuilds the same board from the start (§2). The first tap is replayed, so
 * the mines land exactly where they were and the opening region is the one the
 * player already knows — this is a retry, not a new game.
 */
export function restartSession(session: MinesweeperSession): MinesweeperSession {
  const fresh =
    session.mode === 'daily' && session.dailyDate !== null
      ? createDailySession(session.dailyDate)
      : createDifficultySession(session.difficulty, session.seed);
  if (session.firstIndex === null) return fresh;
  return tapCell(fresh, session.firstIndex) ?? fresh;
}

/** Restores a session from persisted state. */
export function restoreSession(data: Omit<MinesweeperSession, 'status'>): MinesweeperSession {
  return { ...data, status: statusOf(data.board) };
}

/**
 * Opens a cell (§3). The first tap is the one that places the mines: it can
 * never hit one, and it always opens a region (§4).
 *
 * Returns null when nothing changes — a flagged cell, an open cell, or a game
 * that has already ended.
 */
export function tapCell(session: MinesweeperSession, index: number): MinesweeperSession | null {
  if (session.status !== 'playing') return null;
  if (index < 0 || index >= session.board.opened.length) return null;

  if (session.firstIndex === null) {
    const generated = generateField(session.seed, session.difficulty, index);
    const opened = reveal(createBoard(generated.field), index);
    if (opened === null) return null;
    return withBoard({ ...session, firstIndex: index }, opened);
  }

  const board = reveal(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/**
 * Puts a flag down or takes it back (§3). Before the first tap there is nothing
 * to reason about yet, so flagging is refused — the mines do not exist.
 */
export function flagCell(session: MinesweeperSession, index: number): MinesweeperSession | null {
  if (session.status !== 'playing' || session.firstIndex === null) return null;
  const board = toggleFlag(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/** Chords an open number whose flags already match it (§3). */
export function chordCell(session: MinesweeperSession, index: number): MinesweeperSession | null {
  if (session.status !== 'playing') return null;
  const board = chord(session.board, index);
  return board === null ? null : withBoard(session, board);
}

/**
 * One provably safe cell and the numbers that prove it (§7). Free, unlimited,
 * and never a mine. Before the first tap every cell is safe by construction,
 * so there is nothing to prove and nothing to show.
 */
export function hintFor(session: MinesweeperSession): SafeCell | null {
  if (session.firstIndex === null) return null;
  return findHint(session.board);
}

/** Hints are counted for the result screen, never limited or charged for. */
export function countHintUse(session: MinesweeperSession): MinesweeperSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
