/**
 * Pure statistics and progress transitions (kept out of React for testing).
 * What §8 asks for and nothing more: counts, records, play time. No streaks —
 * the daily record is which days were played and what they scored, not a chain
 * (docs/GAME_2048_RULES.md §6, §8, docs/PRODUCT_PRINCIPLES.md).
 *
 * The record transitions take a maximum, so booking the same run twice cannot
 * inflate anything. That is what lets the provider book a run whenever it is
 * finished *or* replaced, without keeping track of which happened.
 */
import { maxTile, type Game2048Session, type GameMode } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/** Registers a started game (new game or restart, not resume). */
export function applyGameStart(stats: Stats, mode: GameMode): Stats {
  const next = structuredClone(stats);
  next[mode].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, mode: GameMode, seconds: number): Stats {
  if (seconds <= 0) return stats;
  const next = structuredClone(stats);
  next[mode].totalPlaySeconds += seconds;
  return next;
}

/**
 * Registers one 2048 (§8). Booked on the move that makes the tile, which is
 * the only moment it can be counted exactly once — the game carries on, so
 * there is no ending to count it at.
 */
export function applyWin(stats: Stats, mode: GameMode): Stats {
  const next = structuredClone(stats);
  next[mode].wins += 1;
  return next;
}

/**
 * Keeps the best score and the highest tile a run reached. Undo does not roll
 * these back: the tile was made and the score was on the board (§5).
 */
export function applyRunRecords(stats: Stats, session: Game2048Session): Stats {
  const bucket = stats[session.mode];
  const bestScore = Math.max(bucket.bestScore, session.score);
  const bestTile = Math.max(bucket.bestTile, maxTile(session.board));
  if (bestScore === bucket.bestScore && bestTile === bucket.bestTile) return stats;
  const next = structuredClone(stats);
  next[session.mode].bestScore = bestScore;
  next[session.mode].bestTile = bestTile;
  return next;
}

export interface RunOutcome {
  readonly progress: Progress;
  /** True when this run beat the previous best for its mode or its day. */
  readonly isNewBest: boolean;
  /** The best score for this board after the run. */
  readonly bestScore: number;
}

/** Records a daily run's score for its date (§6). Classic keeps no calendar. */
export function applyRunToProgress(progress: Progress, session: Game2048Session): RunOutcome {
  if (session.mode !== 'daily' || session.dailyDate === null) {
    return { progress, isNewBest: false, bestScore: session.score };
  }
  const previous = progress.dailyScores[session.dailyDate];
  const isNewBest = previous === undefined || session.score > previous;
  if (!isNewBest) {
    return { progress, isNewBest: false, bestScore: previous };
  }
  return {
    progress: {
      ...progress,
      dailyScores: { ...progress.dailyScores, [session.dailyDate]: session.score },
    },
    isNewBest: true,
    bestScore: session.score,
  };
}

/**
 * The score to beat on this board (§4): a classic game measures itself against
 * every classic game before it, a daily against that same day only.
 */
export function bestScoreFor(
  stats: Stats,
  progress: Progress,
  mode: GameMode,
  dailyDate: string | null,
): number {
  if (mode === 'daily') return dailyDate === null ? 0 : (progress.dailyScores[dailyDate] ?? 0);
  return stats.classic.bestScore;
}

/** How many days have been played — a count, deliberately not a run of days. */
export function dailiesPlayedCount(progress: Progress): number {
  return Object.keys(progress.dailyScores).length;
}
