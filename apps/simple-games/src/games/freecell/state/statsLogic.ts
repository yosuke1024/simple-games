/**
 * Pure statistics transitions (kept out of React for testing). No streaks:
 * the daily record is which days were won, not a chain
 * (docs/FREECELL_RULES.md §6, §9).
 *
 * The win rate is honest arithmetic (§9): played counts every deal begun, won
 * counts the wins, and nothing massages the ratio. Deals are not screened for
 * winnability (§5) and a game can be played into a dead end (§2), so the
 * number is not a measure of skill alone — which is why the counts it came
 * from are shown beside it rather than replaced by it.
 */
import type { FreeCellSession } from '../game';
import type { Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started deal (new deal or retry, not resume). */
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

export interface WinOutcome {
  readonly stats: Stats;
  /** True when this win used fewer moves than any previous win. */
  readonly isNewBestMoves: boolean;
  /** True when this win beat the previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
}

/**
 * Registers a win: the count, both bests, and — for a daily — the day's own
 * record. The outcome a player is shown compares against the record they
 * were actually playing against: the overall bests, or that date's bests.
 */
export function applyWon(stats: Stats, session: FreeCellSession): WinOutcome {
  const next = clone(stats);
  const moves = session.moveCount;
  const seconds = session.elapsedSeconds;

  next.won += 1;
  const wasBestMoves = stats.bestMoves;
  const wasBestSeconds = stats.bestSeconds;
  if (next.bestMoves === null || moves < next.bestMoves) next.bestMoves = moves;
  if (next.bestSeconds === null || seconds < next.bestSeconds) next.bestSeconds = seconds;

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

  return {
    stats: next,
    isNewBestMoves: wasBestMoves === null || moves < wasBestMoves,
    isNewBestTime: wasBestSeconds === null || seconds < wasBestSeconds,
    bestMoves: next.bestMoves ?? moves,
    bestSeconds: next.bestSeconds ?? seconds,
  };
}

/** How many daily deals have been won. A count, never a run of days (§6). */
export function wonDailyCount(stats: Stats): number {
  return Object.keys(stats.dailyMoves).length;
}

/** Whole-percent win rate, or null before the first deal (§9). */
export function winRatePercent(stats: Stats): number | null {
  if (stats.played === 0) return null;
  return Math.round((stats.won / stats.played) * 100);
}
