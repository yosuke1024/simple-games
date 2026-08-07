/**
 * Pure statistics transitions (kept out of React for testing). No streaks: the
 * daily record is which days were won, not a chain
 * (docs/SPIDER_SOLITAIRE_RULES.md §6, §9).
 *
 * Counts are kept per difficulty. A win at four suits and a win at one are not
 * the same achievement, and one rate over both would hide which is which.
 * Total play time is shared, because time is time.
 */
import type { SpiderSession, SuitCount } from '../game';
import { emptySuitStats, type Stats, type SuitStats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const suitKey = (suitCount: SuitCount): string => String(suitCount);

/** That difficulty's row, or a fresh empty one. */
export function statsFor(stats: Stats, suitCount: SuitCount): SuitStats {
  return stats.perSuit[suitKey(suitCount)] ?? emptySuitStats();
}

/** Registers a started deal (new deal or retry, not resume). */
export function applyGameStart(stats: Stats, suitCount: SuitCount): Stats {
  const next = clone(stats);
  const key = suitKey(suitCount);
  const row = next.perSuit[key] ?? emptySuitStats();
  next.perSuit[key] = { ...row, played: row.played + 1 };
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
 * Registers a win: the count for that difficulty, both bests, and — for a
 * daily — the day's own record. The outcome a player is shown compares against
 * the record they were actually playing against.
 */
export function applyWon(stats: Stats, session: SpiderSession): WinOutcome {
  const next = clone(stats);
  const moves = session.moveCount;
  const seconds = session.elapsedSeconds;
  const key = suitKey(session.suitCount);
  const row = next.perSuit[key] ?? emptySuitStats();

  const wasBestMoves = row.bestMoves;
  const wasBestSeconds = row.bestSeconds;
  next.perSuit[key] = {
    played: row.played,
    won: row.won + 1,
    bestMoves: row.bestMoves === null || moves < row.bestMoves ? moves : row.bestMoves,
    bestSeconds: row.bestSeconds === null || seconds < row.bestSeconds ? seconds : row.bestSeconds,
  };

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
    bestMoves: next.perSuit[key]!.bestMoves ?? moves,
    bestSeconds: next.perSuit[key]!.bestSeconds ?? seconds,
  };
}

/** How many daily deals have been won. A count, never a run of days (§6). */
export function wonDailyCount(stats: Stats): number {
  return Object.keys(stats.dailyMoves).length;
}

/** Whole-percent win rate for one difficulty, or null before its first deal (§9). */
export function winRatePercent(stats: Stats, suitCount: SuitCount): number | null {
  const row = statsFor(stats, suitCount);
  if (row.played === 0) return null;
  return Math.round((row.won / row.played) * 100);
}
