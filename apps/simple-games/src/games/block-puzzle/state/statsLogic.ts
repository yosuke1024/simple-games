/**
 * Pure statistics transitions (kept out of React for testing). Counts, the
 * personal best, and total time — no streaks and no ranking
 * (docs/BLOCK_PUZZLE_RULES.md §9, §5).
 *
 * The best score and the cleared lines are booked when a run ends, because
 * that is when a run has a score to compare: the game is endless, so an
 * in-progress board has no final number. A game in progress is never lost to
 * this — it is saved (§10) and comes back — and the one way to drop a run,
 * starting a new game over it, asks first.
 */
import type { BlockSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new board, not a resume). */
export function applyGameStart(stats: Stats): Stats {
  const next = clone(stats);
  next.played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += seconds;
  return next;
}

export interface RunOutcome {
  readonly stats: Stats;
  /** True when this run beat the previous best (§5). */
  readonly isNewBestScore: boolean;
}

/**
 * Registers a finished run: the lines it cleared join the running total, and
 * the score becomes the record if it beats it. The comparison is made against
 * the stats as they were, so the answer is still "did this run beat the
 * previous best" after the best has been raised.
 */
export function applyRunEnd(stats: Stats, session: BlockSession): RunOutcome {
  const next = clone(stats);
  next.linesCleared += session.linesCleared;
  const isNewBestScore = session.score > stats.bestScore;
  if (isNewBestScore) next.bestScore = session.score;
  return { stats: next, isNewBestScore };
}
