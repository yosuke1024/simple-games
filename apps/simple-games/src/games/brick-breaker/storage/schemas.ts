/**
 * Brick Breaker's own persisted records, under the `bb.` prefix. Isolated
 * from the shared records and from every other game: corruption here can
 * never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * There is deliberately no saved-game slot: a real-time board is not
 * restorable in any honest way, so leaving a level abandons the attempt and
 * the retry is free (docs/BRICK_BREAKER_RULES.md §10).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';
import { LEVEL_COUNT } from '../game/levels';

import { BB_STORAGE_KEYS } from './keys';

export { BB_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BB_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/** Counts and totals only — no score in this game (§13) and no streaks. */
export interface Stats {
  schemaVersion: 1;
  played: number;
  cleared: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: BB_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0, cleared: 0, totalPlaySeconds: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const cleared = asInt(raw.cleared, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (played === null || cleared === null || totalPlaySeconds === null) return null;
    return { schemaVersion: 1, played, cleared, totalPlaySeconds };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..LEVEL_COUNT). */
  highestUnlocked: number;
}

export const progressSchema: SchemaDef<Progress> = {
  key: BB_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, highestUnlocked: 1 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, LEVEL_COUNT);
    return highestUnlocked === null ? null : { schemaVersion: 1, highestUnlocked };
  },
};
