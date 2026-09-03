/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * No streaks: the daily record is which days were cleared, not a chain
 * (docs/MAHJONG_SOLITAIRE_RULES.md §9).
 *
 * The only best kept is time, and it is kept per board — level or date —
 * where the board is fixed and the number means something. Retries from the
 * stuck notice count as new games played (played can exceed cleared, and
 * that is the honest arithmetic of a game with dead ends).
 */
import { MAX_LEVEL, type MahjongSession } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats): Stats {
  return { ...stats, played: stats.played + 1 };
}

/** Registers a cleared board. Play time is booked separately, never here. */
export function applyCleared(stats: Stats): Stats {
  return { ...stats, cleared: stats.cleared + 1 };
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, seconds: number): Stats {
  if (seconds <= 0) return stats;
  return { ...stats, totalPlaySeconds: stats.totalPlaySeconds + seconds };
}

export interface ClearOutcome {
  readonly progress: Progress;
  /** True when this run beat the board's previous best time. */
  readonly isNewBestTime: boolean;
  readonly bestSeconds: number;
}

/**
 * Records a clear: unlocks the next level, and keeps the better time for the
 * board. Replaying an old level or an old daily can improve the record but
 * never moves the frontier backwards.
 */
export function applyClearToProgress(progress: Progress, session: MahjongSession): ClearOutcome {
  const next: Progress = {
    ...progress,
    bestSeconds: { ...progress.bestSeconds },
    dailySeconds: { ...progress.dailySeconds },
  };
  const seconds = session.elapsedSeconds;

  const record = (timeMap: Record<string, number>, key: string): ClearOutcome => {
    const previous = timeMap[key];
    const isNewBestTime = previous === undefined || seconds < previous;
    if (isNewBestTime) timeMap[key] = seconds;
    return { progress: next, isNewBestTime, bestSeconds: timeMap[key] ?? seconds };
  };

  if (session.mode === 'level' && session.level !== null) {
    const outcome = record(next.bestSeconds, String(session.level));
    next.highestUnlocked = Math.min(MAX_LEVEL, Math.max(next.highestUnlocked, session.level + 1));
    return outcome;
  }

  if (session.dailyDate !== null) {
    return record(next.dailySeconds, session.dailyDate);
  }

  return { progress: next, isNewBestTime: false, bestSeconds: seconds };
}

/**
 * The record this run is measured against — the board's best before the run
 * is booked — or null when there is none yet (§9). Read before
 * `applyClearToProgress`, which is what moves the record.
 */
export function previousBestFor(progress: Progress, session: MahjongSession): number | null {
  if (session.mode === 'level' && session.level !== null) {
    return progress.bestSeconds[String(session.level)] ?? null;
  }
  if (session.dailyDate !== null) return progress.dailySeconds[session.dailyDate] ?? null;
  return null;
}

/** How many levels have been cleared — shown on the statistics screen. */
export function clearedLevelCount(progress: Progress): number {
  return Object.keys(progress.bestSeconds).length;
}

/** How many daily boards have been cleared. A count, never a run of days. */
export function clearedDailyCount(progress: Progress): number {
  return Object.keys(progress.dailySeconds).length;
}
