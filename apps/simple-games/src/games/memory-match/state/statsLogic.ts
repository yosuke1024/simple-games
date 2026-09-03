/**
 * Pure statistics transitions (kept out of React for testing). No streaks:
 * the daily record is which days were completed, not a chain
 * (docs/MEMORY_MATCH_RULES.md §7, §9).
 *
 * Two bests are kept per board, moves and time, and they are independent: a
 * deliberate game can set the move record while a lucky quick one sets the
 * time record. Collapsing them into one score would quietly tell the player
 * which of the two the game wants, and it does not want either.
 */
import type { Difficulty, MemorySession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new game or retry, not resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, difficulty: Difficulty, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next[difficulty].totalPlaySeconds += seconds;
  return next;
}

export interface ClearOutcome {
  readonly stats: Stats;
  /** True when this run used fewer moves than the board's previous best. */
  readonly isNewBestMoves: boolean;
  /** True when this run beat the board's previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
}

/**
 * Registers a completion: the count and both bests — and, for a daily, the
 * day's own record. A daily game also lives in the medium bucket (§7: the
 * daily is the 4×5 board), the same way Sliding Puzzle books its daily into
 * the 4×4 bucket.
 *
 * The outcome a player is shown compares against the record they were
 * actually playing against: the difficulty's bests, or that date's bests.
 */
export function applySolved(stats: Stats, session: MemorySession): ClearOutcome {
  const next = clone(stats);
  const moves = session.moveCount;
  const seconds = session.elapsedSeconds;

  const bucket = next[session.difficulty];
  bucket.solved += 1;
  if (bucket.bestMoves === null || moves < bucket.bestMoves) bucket.bestMoves = moves;
  if (bucket.bestSeconds === null || seconds < bucket.bestSeconds) bucket.bestSeconds = seconds;

  if (session.mode === 'daily' && session.dailyDate !== null) {
    const date = session.dailyDate;
    const previousMoves = next.dailyMoves[date];
    const previousSeconds = next.dailySeconds[date];
    const isNewBestMoves = previousMoves === undefined || moves < previousMoves;
    const isNewBestTime = previousSeconds === undefined || seconds < previousSeconds;
    if (isNewBestMoves) next.dailyMoves[date] = moves;
    if (isNewBestTime) next.dailySeconds[date] = seconds;
    return {
      stats: next,
      isNewBestMoves,
      isNewBestTime,
      bestMoves: next.dailyMoves[date] ?? moves,
      bestSeconds: next.dailySeconds[date] ?? seconds,
    };
  }

  const previous = stats[session.difficulty];
  return {
    stats: next,
    isNewBestMoves: previous.bestMoves === null || moves < previous.bestMoves,
    isNewBestTime: previous.bestSeconds === null || seconds < previous.bestSeconds,
    bestMoves: bucket.bestMoves ?? moves,
    bestSeconds: bucket.bestSeconds ?? seconds,
  };
}

/**
 * The records this run is measured against — the difficulty's, or that
 * date's, fewest moves and fastest time before the run is booked — null for
 * each there is none of yet (§9). Read before `applySolved`, which moves them.
 */
export function previousBestsFor(
  stats: Stats,
  session: MemorySession,
): { moves: number | null; seconds: number | null } {
  if (session.mode === 'daily' && session.dailyDate !== null) {
    const date = session.dailyDate;
    return { moves: stats.dailyMoves[date] ?? null, seconds: stats.dailySeconds[date] ?? null };
  }
  const bucket = stats[session.difficulty];
  return { moves: bucket.bestMoves, seconds: bucket.bestSeconds };
}

/** How many daily boards have been completed. A count, never a run of days. */
export function solvedDailyCount(stats: Stats): number {
  return Object.keys(stats.dailyMoves).length;
}
