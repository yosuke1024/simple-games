/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were solved, not a chain
 * (docs/SLIDING_PUZZLE_RULES.md §7, §9).
 *
 * Two bests are kept for every board, moves and time, and they are independent:
 * a careful solve can set the move record while a hurried one sets the time
 * record. Collapsing them into a single score would quietly tell the player
 * which of the two the game wants, and it does not want either.
 */
import { MAX_LEVEL, type Size, type SlidingPuzzleSession } from '../game';
import { sizeKey, type Progress, type Stats } from '../storage/schemas';

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, size: Size): Stats {
  const next = structuredClone(stats);
  next[sizeKey(size)].played += 1;
  return next;
}

/**
 * Registers a solve: the count and both bests.
 *
 * Play time is deliberately NOT touched here. It accumulates through
 * `applyPlayTime` as the clock runs, and a solve is booked on top of whatever
 * has already been counted — otherwise the same seconds would land in
 * totalPlaySeconds twice.
 */
export function applySolved(stats: Stats, size: Size, seconds: number, moves: number): Stats {
  const next = structuredClone(stats);
  const bucket = next[sizeKey(size)];
  bucket.solved += 1;
  if (bucket.bestSeconds === null || seconds < bucket.bestSeconds) bucket.bestSeconds = seconds;
  if (bucket.bestMoves === null || moves < bucket.bestMoves) bucket.bestMoves = moves;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, size: Size, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = structuredClone(stats);
  next[sizeKey(size)].totalPlaySeconds += seconds;
  return next;
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this run used fewer moves than the board's previous best. */
  readonly isNewBestMoves: boolean;
  /** True when this run beat the board's previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
}

/**
 * Records a solve: unlocks the next level, and keeps the better of each record
 * for the board. Replaying an old level or an old daily can improve either one
 * but never moves the frontier backwards.
 */
export function applySolveToProgress(
  progress: Progress,
  session: SlidingPuzzleSession,
): ClearOutcome {
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

  return {
    progress: next,
    isNewBestMoves: false,
    isNewBestTime: false,
    bestMoves: moves,
    bestSeconds: seconds,
  };
}

/** How many levels have been solved — shown on the level list. */
export function solvedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestMoves).length;
}

/** How many daily boards have been solved. A count, never a run of days (§7). */
export function solvedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailyMoves).length;
}
