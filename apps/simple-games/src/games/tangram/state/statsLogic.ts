/**
 * Pure statistics and progress transitions (kept out of React so they can be
 * tested). docs/TANGRAM_RULES.md §7:
 *
 * - `played` counts figures started (a new figure or a retry, never a resume);
 *   `solved` counts completions — the same figure completed twice counts twice.
 * - Play time is booked per bucket (the tier in Free Play, the daily's own row
 *   in a daily) as it is played, never twice.
 * - `tn.progress` keeps, per figure, the fastest Free Play completion and,
 *   per tier, the figure last started in Free Play. A daily never writes it.
 * - The daily keeps a set of dates with that day's fastest time — never a run:
 *   no streak exists anywhere here, and none can be derived (§6).
 *
 * There is no score, no star and no rank (§1, §12).
 */
import { figureById, TIERS, type GameMode, type Tier } from '../game';
import type { Progress, Stats } from '../storage/schemas';

/**
 * Deep-copies a plain record. `structuredClone` needs a 2022-era WebView
 * (Chromium 98) and low-spec devices are a release requirement; these records
 * are small pure data, so the JSON round-trip covers every engine we reach.
 */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Which row of the statistics a figure's plays and time belong to (§7). */
export type Bucket = Tier | 'daily';

export const bucketOf = (mode: GameMode, tier: Tier): Bucket => (mode === 'daily' ? 'daily' : tier);

/** Registers a started figure (a new one or a retry, never a resume). */
export function applyGameStart(stats: Stats, bucket: Bucket): Stats {
  const next = clone(stats);
  next[bucket].played += 1;
  return next;
}

/** Books play seconds that have not been counted yet. */
export function applyPlayTime(stats: Stats, bucket: Bucket, seconds: number): Stats {
  if (!(seconds > 0)) return stats;
  const next = clone(stats);
  next[bucket].totalPlaySeconds += Math.floor(seconds);
  return next;
}

export interface CompletionOutcome {
  readonly stats: Stats;
  readonly progress: Progress;
  /**
   * The record this completion is measured against, or null on a first
   * completion: the figure's fastest Free Play time, or that day's fastest
   * daily. A first completion sets a record and says nothing (§7).
   */
  readonly previous: number | null;
}

export interface Completion {
  readonly mode: GameMode;
  readonly tier: Tier;
  readonly figure: string;
  readonly dailyDate: string | null;
  readonly seconds: number;
}

/**
 * Registers a completion: the tier's count in Free Play and the figure's
 * fastest time; for a daily, the day's fastest time. Play time is not touched
 * here — it accumulates through `applyPlayTime`, so the same seconds cannot
 * land twice.
 */
export function applyCompletion(
  stats: Stats,
  progress: Progress,
  done: Completion,
): CompletionOutcome {
  const nextStats = clone(stats);
  if (done.mode === 'daily' && done.dailyDate !== null) {
    const previous = nextStats.dailyTimes[done.dailyDate] ?? null;
    if (previous === null || done.seconds < previous) {
      nextStats.dailyTimes[done.dailyDate] = done.seconds;
    }
    return { stats: nextStats, progress, previous };
  }
  nextStats[done.tier].solved += 1;
  const nextProgress = clone(progress);
  const previous = nextProgress.best[done.figure] ?? null;
  if (previous === null || done.seconds < previous) nextProgress.best[done.figure] = done.seconds;
  return { stats: nextStats, progress: nextProgress, previous };
}

/** Remembers the figure last started in a tier's Free Play (§6 `last`). */
export function applyLastStarted(progress: Progress, tier: Tier, figure: string): Progress {
  if (progress.last[tier] === figure) return progress;
  const next = clone(progress);
  next.last[tier] = figure;
  return next;
}

/** Whether a figure has a Free Play completion (§6「未解決」). */
export const isSolvedIn = (progress: Progress) => (id: string) => progress.best[id] !== undefined;

/** How many different figures of a tier have been completed — a count, never "n of N" (§7). */
export function solvedFiguresOf(progress: Progress, tier: Tier): number {
  return Object.keys(progress.best).filter((id) => figureById(id)?.tier === tier).length;
}

/** How many days the daily has been completed — a count, never a run (§7). */
export const dailiesCompleted = (stats: Stats): number => Object.keys(stats.dailyTimes).length;

/** Play time across every tier and the daily (§7): the four rows added, not stored. */
export const totalPlaySeconds = (stats: Stats): number =>
  TIERS.reduce((sum, tier) => sum + stats[tier].totalPlaySeconds, 0) + stats.daily.totalPlaySeconds;
