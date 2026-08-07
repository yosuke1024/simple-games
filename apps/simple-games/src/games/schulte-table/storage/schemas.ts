/**
 * Schulte Table's own persisted records, under the `st.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/SCHULTE_TABLE_RULES.md §11).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, isRecord } from '../../../storage/validate';
import { isSize, MAX_LEVEL, SIZES, type Size } from '../game';

import { ST_STORAGE_KEYS } from './keys';

export { ST_STORAGE_KEYS };

/** Statistics are kept per board size (§10). */
export type SizeKey = `size${Size}`;
export const sizeKey = (size: Size): SizeKey => `size${size}`;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: ST_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

export interface SizeStats {
  played: number;
  cleared: number;
  totalPlaySeconds: number;
  /** Shortest finished round at this size, or null before the first one. */
  bestSeconds: number | null;
  /**
   * Every wrong tap ever made at this size. A total, deliberately — not a
   * "fewest misses" record, which would reward tapping slowly (§9).
   */
  totalMisses: number;
}

/** Per board size, plus nothing else: no streaks anywhere (§8, §10). */
export interface Stats {
  schemaVersion: 1;
  size3: SizeStats;
  size4: SizeStats;
  size5: SizeStats;
}

const emptySizeStats = (): SizeStats => ({
  played: 0,
  cleared: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
  totalMisses: 0,
});

const validateSizeStats = (raw: unknown): SizeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const cleared = asInt(raw.cleared, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const totalMisses = asInt(raw.totalMisses, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || cleared === null || totalPlaySeconds === null || totalMisses === null) {
    return null;
  }
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, cleared, totalPlaySeconds, bestSeconds, totalMisses };
};

export const statsSchema: SchemaDef<Stats> = {
  key: ST_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    size3: emptySizeStats(),
    size4: emptySizeStats(),
    size5: emptySizeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const size3 = validateSizeStats(raw.size3);
    const size4 = validateSizeStats(raw.size4);
    const size5 = validateSizeStats(raw.size5);
    if (size3 === null || size4 === null || size5 === null) return null;
    return { schemaVersion: 1, size3, size4, size5 };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..100). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → shortest time in seconds. */
  bestSeconds: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → shortest time for that day. */
  dailySeconds: Record<string, number>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

/**
 * Malformed entries are dropped rather than rejecting the whole record: one bad
 * key must not cost the player their whole history. The smaller of two values
 * wins on a duplicate key, since the map holds bests.
 */
function validateLevelMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const level = /^\d{1,3}$/.test(key) ? Number(key) : NaN;
    const amount = asInt(value, 0, 1e9);
    if (level >= 1 && level <= MAX_LEVEL && amount !== null) {
      const existing = out[String(level)];
      out[String(level)] = existing === undefined ? amount : Math.min(existing, amount);
    }
  }
  return out;
}

function validateDailyMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isRecord(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const amount = asInt(value, 0, 1e9);
    if (
      asDateString(key) !== null &&
      amount !== null &&
      Object.keys(out).length < MAX_DAILY_ENTRIES
    ) {
      out[key] = amount;
    }
  }
  return out;
}

export const progressSchema: SchemaDef<Progress> = {
  key: ST_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    highestUnlocked: 1,
    bestSeconds: {},
    dailySeconds: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null) return null;
    return {
      schemaVersion: 1,
      highestUnlocked,
      bestSeconds: validateLevelMap(raw.bestSeconds),
      dailySeconds: validateDailyMap(raw.dailySeconds),
    };
  },
};

/** Guards a size read back from storage before it indexes the stats record. */
export const asSize = (value: unknown): Size | null => (isSize(value) ? value : null);

export { SIZES };
