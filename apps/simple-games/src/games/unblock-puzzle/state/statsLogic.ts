/**
 * Pure statistics transitions (kept out of React so they can be tested).
 * Per difficulty: boards played, boards solved, boards solved in exactly
 * their fewest moves, fastest clear, total play time — plus, for the daily,
 * the fewest moves each cleared day took (docs/UNBLOCK_PUZZLE_RULES.md §10).
 *
 * There is no streak anywhere here, and none can be derived from what is
 * kept: a set of dates is not a chain (§9, docs/PRODUCT_PRINCIPLES.md).
 * There is no score either. A board's fewest moves differ from board to
 * board, so "fewest moves" means nothing across a difficulty — it is kept
 * per day for the daily (everyone's board that day is the same one) and as a
 * count of exact clears per difficulty (§10, §16).
 */
import { cellsMoved, moveCount, type Difficulty, type UnblockSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (a new board or a retry, never a resume). */
export function applyGameStart(stats: Stats, difficulty: Difficulty): Stats {
  const next = clone(stats);
  next[difficulty].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, difficulty: Difficulty, seconds: number): Stats {
  if (!(seconds > 0)) return stats;
  const next = clone(stats);
  next[difficulty].totalPlaySeconds += Math.floor(seconds);
  return next;
}

export interface SolveOutcome {
  readonly stats: Stats;
  /** True when this clear beat a record the player already had (§10). */
  readonly improved: boolean;
  /**
   * What the record was before this clear, or null on a first clear: the
   * fastest time for the difficulty, or — for a daily — the fewest moves that
   * day. A first clear sets a record without beating one.
   */
  readonly previous: number | null;
  /** True when the clear took exactly the board's fewest moves. */
  readonly optimal: boolean;
}

/**
 * Registers a clear: the count, the exact-clear count, the fastest time, and
 * — for a daily — the fewest moves that day. Play time is deliberately not
 * touched here; it accumulates through `applyPlayTime` as the clock runs, so
 * the same seconds cannot land twice.
 */
export function applySolved(stats: Stats, session: UnblockSession): SolveOutcome {
  const next = clone(stats);
  const seconds = session.elapsedSeconds;
  const moves = moveCount(session);
  const optimal = moves === session.minMoves;
  const bucket = next[session.difficulty];

  bucket.solved += 1;
  if (optimal) bucket.optimal += 1;
  const previousSeconds = bucket.bestSeconds;
  if (previousSeconds === null || seconds < previousSeconds) bucket.bestSeconds = seconds;

  if (session.mode === 'daily' && session.dailyDate !== null) {
    const previousMoves = next.dailyMoves[session.dailyDate] ?? null;
    if (previousMoves === null || moves < previousMoves) {
      next.dailyMoves[session.dailyDate] = moves;
    }
    return {
      stats: next,
      improved: previousMoves !== null && moves < previousMoves,
      previous: previousMoves,
      optimal,
    };
  }

  return {
    stats: next,
    improved: previousSeconds !== null && seconds < previousSeconds,
    previous: previousSeconds,
    optimal,
  };
}

/** How many days the daily has been cleared — a count, never a run (§10). */
export const dailiesCleared = (stats: Stats): number => Object.keys(stats.dailyMoves).length;

/** Play time across every difficulty, the daily included (it is Medium) (§10). */
export const totalPlaySeconds = (stats: Stats): number =>
  stats.easy.totalPlaySeconds + stats.medium.totalPlaySeconds + stats.hard.totalPlaySeconds;

/** The facts of one clear, as the result card shows them (§10). */
export interface ClearFacts {
  readonly moves: number;
  readonly minMoves: number;
  readonly cellsMoved: number;
  readonly seconds: number;
  readonly hints: number;
}

export const clearFactsOf = (session: UnblockSession): ClearFacts => ({
  moves: moveCount(session),
  minMoves: session.minMoves,
  cellsMoved: cellsMoved(session),
  seconds: session.elapsedSeconds,
  hints: session.hintCount,
});
