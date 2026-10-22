/**
 * Progress and statistics shapes, and the pure bookkeeping on them —
 * docs/ECHO_PADS_RULES.md §2, §7, §9. The storage layer (Phase 3) validates
 * and persists these; nothing here reads or writes storage.
 *
 * The attempt counter is kept, unlike Number Recall §8: a failed round can be
 * heard again as often as wanted, so starting over at r0 after every reload
 * would let a fixed sequence be learned bit by bit. An attempt is used up when
 * a run *starts*, so a failure, a clear or a replaced run all move on to a
 * sequence never played before.
 */
import { isLevel, LEVEL_COUNT, levelSpec, previousLevelInTier } from './levels';
import type { PadCount } from './types';

export interface DailyProgress {
  /** Local YYYY-MM-DD the counter belongs to. */
  readonly date: string;
  readonly nextAttempt: number;
}

export interface EchoProgress {
  /** Index `level - 1`: whether that level has been cleared. */
  readonly cleared: readonly boolean[];
  /** Index `level - 1`: the attempt the next run at that level gets. */
  readonly nextAttempt: readonly number[];
  /** Today's daily counter; another day's counts for nothing. */
  readonly daily: DailyProgress | null;
}

export function emptyProgress(): EchoProgress {
  return {
    cleared: new Array<boolean>(LEVEL_COUNT).fill(false),
    nextAttempt: new Array<number>(LEVEL_COUNT).fill(0),
    daily: null,
  };
}

/** Each tier's first level is open; the next opens on a clear (§2). */
export function isUnlocked(progress: EchoProgress, level: number): boolean {
  if (!isLevel(level)) return false;
  const previous = previousLevelInTier(level);
  return previous === null || progress.cleared[previous - 1] === true;
}

export interface BegunRun {
  readonly progress: EchoProgress;
  readonly attempt: number;
}

/** Uses up the level's next attempt; null for a locked or unknown level. */
export function beginLevelRun(progress: EchoProgress, level: number): BegunRun | null {
  if (!isUnlocked(progress, level)) return null;
  const attempt = progress.nextAttempt[level - 1] ?? 0;
  const nextAttempt = progress.nextAttempt.slice();
  nextAttempt[level - 1] = attempt + 1;
  return { progress: { ...progress, nextAttempt }, attempt };
}

/** Uses up today's next daily attempt; a new day starts from 0 (§7). */
export function beginDailyRun(progress: EchoProgress, today: string): BegunRun {
  const attempt = progress.daily && progress.daily.date === today ? progress.daily.nextAttempt : 0;
  return { progress: { ...progress, daily: { date: today, nextAttempt: attempt + 1 } }, attempt };
}

/** Marks a level cleared, which opens the next one in its tier. */
export function recordLevelClear(progress: EchoProgress, level: number): EchoProgress {
  if (!isLevel(level) || progress.cleared[level - 1]) return progress;
  const cleared = progress.cleared.slice();
  cleared[level - 1] = true;
  return { ...progress, cleared };
}

/** Statistics rows (§9): the daily is its own row, not part of 6 pads. */
export type StatsRow = 'pads4' | 'pads6' | 'daily';
export const STATS_ROWS: readonly StatsRow[] = ['pads4', 'pads6', 'daily'];

export interface RowStats {
  readonly played: number;
  readonly cleared: number;
  readonly failed: number;
  readonly seconds: number;
}

export interface EchoStats {
  readonly rows: Readonly<Record<StatsRow, RowStats>>;
  /** Days whose daily was cleared, recorded on the first clear only (§7). */
  readonly dailyDates: readonly string[];
}

const emptyRow = (): RowStats => ({ played: 0, cleared: 0, failed: 0, seconds: 0 });

export function emptyStats(): EchoStats {
  return { rows: { pads4: emptyRow(), pads6: emptyRow(), daily: emptyRow() }, dailyDates: [] };
}

/** The row a run counts in. */
export function statsRowFor(mode: 'level' | 'daily', padCount: PadCount): StatsRow {
  if (mode === 'daily') return 'daily';
  return padCount === 4 ? 'pads4' : 'pads6';
}

/** The row for a level, or null for an unknown level. */
export function statsRowForLevel(level: number): StatsRow | null {
  const spec = levelSpec(level);
  return spec ? statsRowFor('level', spec.padCount) : null;
}

function updateRow(stats: EchoStats, row: StatsRow, patch: (r: RowStats) => RowStats): EchoStats {
  return { ...stats, rows: { ...stats.rows, [row]: patch(stats.rows[row]) } };
}

/** A run started: played counts what was begun (§9). */
export function countRunStart(stats: EchoStats, row: StatsRow): EchoStats {
  return updateRow(stats, row, (r) => ({ ...r, played: r.played + 1 }));
}

/** A run ended in a clear or a failure. */
export function countRunEnd(
  stats: EchoStats,
  row: StatsRow,
  outcome: 'cleared' | 'failed',
): EchoStats {
  return updateRow(stats, row, (r) =>
    outcome === 'cleared' ? { ...r, cleared: r.cleared + 1 } : { ...r, failed: r.failed + 1 },
  );
}

/** Adds play seconds not yet counted. */
export function addRowSeconds(stats: EchoStats, row: StatsRow, seconds: number): EchoStats {
  if (!Number.isFinite(seconds) || seconds <= 0) return stats;
  return updateRow(stats, row, (r) => ({ ...r, seconds: r.seconds + seconds }));
}

/** The first clear of a day's daily records the day; later clears change nothing. */
export function recordDailyClear(stats: EchoStats, date: string): EchoStats {
  if (stats.dailyDates.includes(date)) return stats;
  return { ...stats, dailyDates: [...stats.dailyDates, date].sort() };
}
