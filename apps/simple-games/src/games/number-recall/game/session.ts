/**
 * RecallSession — a pure, immutable snapshot of one round in progress: the
 * layout, how far along 1..K the player has got, and which attempt this is.
 * The React layer only dispatches into these functions; all rules live here.
 *
 * There is no undo history, because there is no undo (§10): a tap is the claim
 * "I remember where that was", and taking it back would make the round a
 * search rather than a recollection. There is no saved game either (§12) —
 * short-term memory does not survive the app being closed, so the only honest
 * resume is a new round.
 *
 * There is no clock on screen (§5); elapsed seconds are carried here for the
 * result screen and the statistics only. They include the time spent looking
 * at the tiles, which is the point: looking longer is safer and slower, and
 * that trade is the game (§3).
 */
import { DAILY_SIZE, DAILY_TILES, dailySeed } from './daily';
import { generateLayout, indexOfTile } from './layout';
import { clampLevel, levelSeed, sizeForLevel, tilesForLevel } from './levels';
import { EMPTY, type GameMode, type GameStatus, type Layout, type Size } from './types';

export interface RecallSession {
  readonly mode: GameMode;
  readonly seed: string;
  readonly size: Size;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  /** N² slots row-major: 0 empty, 1..K a tile. */
  readonly layout: Layout;
  /** K — how many tiles this round holds. */
  readonly tileCount: number;
  /** How many of 1..K have been tapped correctly. */
  readonly revealedCount: number;
  /**
   * Which try at this level or date this is, counting from 0. It is part of
   * the seed (§8) and it is what makes "cleared first time" a fact the
   * statistics can record (§5).
   */
  readonly attempt: number;
  readonly status: GameStatus;
  /** On a failure, the cell that should have been tapped (§4). */
  readonly expectedIndex: number | null;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  size: Size,
  tiles: number,
  dailyDate: string | null,
  level: number | null,
  attempt: number,
): RecallSession {
  return {
    mode,
    seed,
    size,
    dailyDate,
    level,
    layout: generateLayout(seed, size, tiles),
    tileCount: tiles,
    revealedCount: 0,
    attempt,
    status: 'playing',
    expectedIndex: null,
    elapsedSeconds: 0,
  };
}

/** A fresh round at a level. `attempt` picks which layout of that level. */
export function createLevelSession(level: number, attempt = 0): RecallSession {
  const target = clampLevel(level);
  const tries = Math.max(0, Math.floor(attempt));
  return baseSession(
    'level',
    levelSeed(target, tries),
    sizeForLevel(target),
    tilesForLevel(target),
    null,
    target,
    tries,
  );
}

/** A fresh daily round for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string, attempt = 0): RecallSession {
  const tries = Math.max(0, Math.floor(attempt));
  return baseSession(
    'daily',
    dailySeed(dateString, tries),
    DAILY_SIZE,
    DAILY_TILES,
    dateString,
    null,
    tries,
  );
}

/**
 * The next round after this one: same difficulty, **different layout** (§8).
 *
 * This is where Number Recall parts company with Memory Match, which offers
 * the same board again. Memory Match can, because its board is still mostly
 * face down after a try. Here the answer has just been shown in full, so
 * handing back the same layout would be asking the player to read it, not to
 * remember it.
 */
export function retrySession(session: RecallSession): RecallSession {
  const attempt = session.attempt + 1;
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level, attempt)
    : createDailySession(session.dailyDate ?? '', attempt);
}

/**
 * Whether the tiles are still all showing — the memorise phase (§3).
 *
 * It is derived rather than stored: the phase ends when the player taps `1`,
 * which is exactly what moves `revealedCount` off zero. A separate flag could
 * disagree with the count; this cannot.
 */
export function isMemorising(session: RecallSession): boolean {
  return session.status === 'playing' && session.revealedCount === 0;
}

/** Whether the tile at `index` shows its number right now. */
export function isFaceUp(session: RecallSession, index: number): boolean {
  const value = session.layout[index];
  if (value === undefined || value === EMPTY) return false;
  // A finished round shows everything: the win, and the answer after a miss.
  if (session.status !== 'playing') return true;
  // Before the first tap, everything is visible and there is no time limit.
  if (session.revealedCount === 0) return true;
  return value <= session.revealedCount;
}

/** The number the player must tap next, or null once the round is over. */
export function nextTarget(session: RecallSession): number | null {
  return session.status === 'playing' ? session.revealedCount + 1 : null;
}

/**
 * Taps a cell.
 *
 * Returns null when the tap does nothing at all: an empty cell, a tile already
 * face up, an index off the board, or a finished round (§3). Those are not
 * failures — the player did not name a wrong tile, they touched something that
 * is not part of the question.
 *
 * A wrong *tile* ends the round (§4). The board is then fully revealed, with
 * the tile that should have been tapped marked, and the way on is a new layout
 * at the same level (§8).
 */
export function tapCell(session: RecallSession, index: number): RecallSession | null {
  if (session.status !== 'playing') return null;
  const value = session.layout[index];
  if (value === undefined || value === EMPTY) return null;
  if (value <= session.revealedCount) return null;

  const wanted = session.revealedCount + 1;
  if (value !== wanted) {
    return {
      ...session,
      status: 'failed',
      expectedIndex: indexOfTile(session.layout, wanted),
    };
  }

  const revealedCount = session.revealedCount + 1;
  return {
    ...session,
    revealedCount,
    status: revealedCount === session.tileCount ? 'cleared' : 'playing',
  };
}
