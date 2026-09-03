/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were solved, not a chain
 * (docs/WATER_SORT_RULES.md §7, §9).
 *
 * Two bests are kept for every board, pours and time, and they are
 * independent: a careful solve can set the pour record while a brisk one
 * sets the time record. Collapsing them into one score would quietly tell
 * the player which of the two the game wants, and it does not want either.
 */
import { MAX_LEVEL, type WaterSession } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats): Stats {
  const next = clone(stats);
  next.played += 1;
  return next;
}

/** Registers a solve. Play time books through applyPlayTime, never here. */
export function applySolved(stats: Stats): Stats {
  const next = clone(stats);
  next.solved += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = clone(stats);
  next.totalPlaySeconds += seconds;
  return next;
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this run used fewer pours than the board's previous best. */
  readonly isNewBestMoves: boolean;
  /** True when this run beat the board's previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
}

/**
 * Records a solve: unlocks the next level, and keeps the better of each
 * record for the board. Replaying an old level or an old daily can improve
 * either one but never moves the frontier backwards.
 */
export function applySolveToProgress(progress: Progress, session: WaterSession): ClearOutcome {
  const next: Progress = {
    ...progress,
    bestMoves: { ...progress.bestMoves },
    bestSeconds: { ...progress.bestSeconds },
    dailyMoves: { ...progress.dailyMoves },
    dailySeconds: { ...progress.dailySeconds },
  };
  const seconds = session.elapsedSeconds;
  const moves = session.moveCount;

  const record = (
    moveMap: Record<string, number>,
    timeMap: Record<string, number>,
    key: string,
  ): ClearOutcome => {
    const previousMoves = moveMap[key];
    const previousSeconds = timeMap[key];
    const isNewBestMoves = previousMoves === undefined || moves < previousMoves;
    const isNewBestTime = previousSeconds === undefined || seconds < previousSeconds;
    if (isNewBestMoves) moveMap[key] = moves;
    if (isNewBestTime) timeMap[key] = seconds;
    return {
      progress: next,
      isNewBestMoves,
      isNewBestTime,
      bestMoves: moveMap[key] ?? moves,
      bestSeconds: timeMap[key] ?? seconds,
    };
  };

  if (session.mode === 'level' && session.level !== null) {
    const outcome = record(next.bestMoves, next.bestSeconds, String(session.level));
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    return outcome;
  }

  if (session.dailyDate !== null) {
    return record(next.dailyMoves, next.dailySeconds, session.dailyDate);
  }

  // A free board (§6「フリープレイ」) has no board to keep a record for:
  // nothing moves, and the run's own numbers are all the card can state.
  return {
    progress: next,
    isNewBestMoves: false,
    isNewBestTime: false,
    bestMoves: moves,
    bestSeconds: seconds,
  };
}

/** The two records a board keeps, or null where there is none yet. */
export interface PreviousBest {
  readonly moves: number | null;
  readonly seconds: number | null;
}

/**
 * The records this run is measured against — the board's bests before the
 * run is booked — or null where there is none yet (§9). Read before
 * `applySolveToProgress`, which is what moves them. A free board has none:
 * the statistics hold counts, not bests, so there is nothing to stand
 * against and the card says nothing about a record.
 */
export function previousBestFor(progress: Progress, session: WaterSession): PreviousBest {
  if (session.mode === 'level' && session.level !== null) {
    const key = String(session.level);
    return { moves: progress.bestMoves[key] ?? null, seconds: progress.bestSeconds[key] ?? null };
  }
  if (session.dailyDate !== null) {
    return {
      moves: progress.dailyMoves[session.dailyDate] ?? null,
      seconds: progress.dailySeconds[session.dailyDate] ?? null,
    };
  }
  return { moves: null, seconds: null };
}

/** How many levels have been solved — shown on the level list. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestMoves).length;
}

/** How many daily boards have been solved. A count, never a run of days (§7). */
export function solvedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailyMoves).length;
}
