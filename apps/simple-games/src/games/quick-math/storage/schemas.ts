/**
 * Quick Math's own persisted records, under the `qm.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/QUICK_MATH_RULES.md §9).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { MAX_LEVEL, TRACKS, type GameMode, type StatsBucket } from '../game';

import { QM_STORAGE_KEYS } from './keys';

export { QM_STORAGE_KEYS };

/** Statistics are kept per band, plus one bucket for dailies (§10). */
export const STATS_BUCKETS: readonly StatsBucket[] = [...TRACKS, 'daily'];

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: QM_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

export interface BucketStats {
  played: number;
  cleared: number;
  totalPlaySeconds: number;
  /** Shortest finished set in this band, or null before the first one. */
  bestSeconds: number | null;
  /**
   * Every wrong answer ever given in this band. A total, deliberately — not a
   * "fewest mistakes" record, which would reward answering slowly (§4).
   */
  totalMisses: number;
}

export type Stats = { schemaVersion: 1 } & Record<StatsBucket, BucketStats>;

const emptyBucket = (): BucketStats => ({
  played: 0,
  cleared: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
  totalMisses: 0,
});

const validateBucket = (raw: unknown): BucketStats | null => {
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

const emptyStats = (): Stats => {
  const value = { schemaVersion: 1 } as Stats;
  for (const bucket of STATS_BUCKETS) value[bucket] = emptyBucket();
  return value;
};

export const statsSchema: SchemaDef<Stats> = {
  key: QM_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: emptyStats,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const value = { schemaVersion: 1 } as Stats;
    for (const bucket of STATS_BUCKETS) {
      const parsed = validateBucket(raw[bucket]);
      if (parsed === null) return null;
      value[bucket] = parsed;
    }
    return value;
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
  key: QM_STORAGE_KEYS.progress,
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

// ---------- saved set ----------

/**
 * A set in progress is four numbers and a name (§9). The questions are NOT
 * here: they come back from the seed, which is the only way a saved record and
 * the generator can never disagree about what question 7 was.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  dailyDate: string | null;
  level: number | null;
  solvedCount: number;
  missCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

/** Twenty questions is the longest set there is; the index lives below it. */
const MAX_QUESTION_INDEX = 100;

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'level' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  const solvedCount = asInt(raw.solvedCount, 0, MAX_QUESTION_INDEX);
  const missCount = asInt(raw.missCount, 0, 1e6);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    solvedCount === null ||
    missCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (level === null && raw.level !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'level' && level === null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    dailyDate,
    level,
    solvedCount,
    missCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (§9).
 *
 * That is the whole point of passing the expected mode in. Without it, a daily
 * record sitting in the `level` key loads happily, and resuming it switches the
 * app to the daily slot: the player asks for one set and is shown the other
 * one, or a blank screen where the other one isn't.
 */
function gameSlotSchema(key: string, expectedMode: GameMode): SchemaDef<PersistedGame | null> {
  return {
    key,
    version: 1,
    defaultValue: () => null,
    validate: (raw) => {
      const parsed = validatePersistedGame(raw);
      return parsed !== null && parsed.mode === expectedMode ? parsed : null;
    },
  };
}

/** Suspended level set. */
export const gameSchema = gameSlotSchema(QM_STORAGE_KEYS.game, 'level');
/** Suspended daily set, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(QM_STORAGE_KEYS.dailyGame, 'daily');
