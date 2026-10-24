/**
 * The pure half of what the storage layer persists (docs/OVERTAKE_RULES.md
 * §9): the unlock frontier `ot.progress`, the counts of `ot.stats` and the
 * control choice of `ot.prefs`. There is no saved race (§9 — a real-time
 * board has no honest resume), so nothing about a race in progress is ever
 * encoded.
 *
 * Decoders fail closed and never throw: anything out of shape is null, and
 * the storage layer falls back to the record's default (§9).
 */
import { ALL_CLEARED, LEVEL_COUNT, clampLevel } from './levels';
import type { Controls } from './input';

export const CONTROLS: readonly Controls[] = ['drag', 'buttons'];
export const DEFAULT_CONTROLS: Controls = 'drag';

/** Largest count a record may carry (the bound the other games' stats use). */
export const MAX_COUNT = 1e9;
export const MAX_SECONDS = 1e12;

function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** `highestUnlocked`: 1..100 names the frontier level, 101 means all cleared (§7). */
export function decodeHighestUnlocked(value: unknown): number | null {
  return isWholeNumber(value, 1, ALL_CLEARED) ? value : null;
}

export function decodeControls(value: unknown): Controls | null {
  return value === 'drag' || value === 'buttons' ? value : null;
}

export interface StatsCounts {
  readonly played: number;
  readonly totalPlaySeconds: number;
}

/**
 * The two counts of an `ot.stats` record. It reads only those two fields: it
 * does not look at `schemaVersion` and ignores extra keys. Phase 3's storage
 * schema must check `schemaVersion === 1` itself before calling this, so a
 * record of another version (or none) is rejected rather than read.
 */
export function decodeStats(raw: unknown): StatsCounts | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const { played, totalPlaySeconds } = record;
  if (!isWholeNumber(played, 0, MAX_COUNT)) return null;
  if (!isWholeNumber(totalPlaySeconds, 0, MAX_SECONDS)) return null;
  return { played, totalPlaySeconds };
}

/**
 * First place on level ℓ opens ℓ + 1 (101 after Lv100); the frontier never
 * moves back (§9). A place on a level that is not unlocked (or not a level
 * at all) changes nothing — a bad level number from the caller cannot jump
 * the frontier.
 */
export function advanceProgress(highestUnlocked: number, level: number, place: number): number {
  const current = decodeHighestUnlocked(highestUnlocked) ?? 1;
  if (place !== 1 || !isUnlocked(current, level)) return current;
  return Math.max(current, Math.min(ALL_CLEARED, level + 1));
}

/** The level Play and the level picker point at: the frontier, held at 100 once all are cleared (§11). */
export function playableLevel(highestUnlocked: number): number {
  return Math.min(LEVEL_COUNT, decodeHighestUnlocked(highestUnlocked) ?? 1);
}

/** The home's Levels chip: n of `n/100` (§7). */
export function clearedCount(highestUnlocked: number): number {
  return Math.min(LEVEL_COUNT, (decodeHighestUnlocked(highestUnlocked) ?? 1) - 1);
}

export function isUnlocked(highestUnlocked: number, level: number): boolean {
  return (
    Number.isInteger(level) &&
    level >= 1 &&
    level <= LEVEL_COUNT &&
    level <= (decodeHighestUnlocked(highestUnlocked) ?? 1)
  );
}

/** Adds a played race (§9: counted when it starts moving). */
export function addPlayed(stats: StatsCounts): StatsCounts {
  return { ...stats, played: Math.min(MAX_COUNT, stats.played + 1) };
}

/** Books whole seconds (§9). Negative or fractional input books nothing extra. */
export function addSeconds(stats: StatsCounts, seconds: number): StatsCounts {
  const whole = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return { ...stats, totalPlaySeconds: Math.min(MAX_SECONDS, stats.totalPlaySeconds + whole) };
}

/** The result card's facts (§11): first place clears and offers Next (not on Lv100). */
export interface RaceResult {
  readonly level: number;
  readonly place: number;
  readonly bumps: number;
  readonly cleared: boolean;
  readonly nextLevel: number | null;
  /** ShareAction's outcome: `completed` only for first place. */
  readonly outcome: 'completed' | 'played';
}

export function raceResult(level: number, place: number, bumps: number): RaceResult {
  const l = clampLevel(level);
  const cleared = place === 1;
  return {
    level: l,
    place,
    bumps,
    cleared,
    nextLevel: cleared && l < LEVEL_COUNT ? l + 1 : null,
    outcome: cleared ? 'completed' : 'played',
  };
}
