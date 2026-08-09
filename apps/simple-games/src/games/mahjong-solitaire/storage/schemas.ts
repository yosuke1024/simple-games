/**
 * Mahjong Solitaire's own persisted records, under the `mj.` prefix. Isolated
 * from the shared records and from every other game: corruption here can
 * never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/MAHJONG_SOLITAIRE_RULES.md §10).
 *
 * A saved game is identity plus the ordered removal pairs — no seed, no
 * layout, no faces. Those derive from the identity, and storing them would
 * create a second truth that could disagree with the first (§10). This
 * schema checks only SHAPE; whether the removal order could actually have
 * been played is the replay gate in gamePersistence.ts.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, isRecord } from '../../../storage/validate';
import { MAX_LEVEL, type GameMode } from '../game';
import { MJ_STORAGE_KEYS } from './keys';

export { MJ_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: MJ_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/** One bucket (§9): boards vary too much for a global best to mean anything —
 * per-board bests live in Progress, where the board is fixed. */
export interface Stats {
  schemaVersion: 1;
  played: number;
  cleared: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: MJ_STORAGE_KEYS.stats,
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
  /** Highest level the player may start (1..100). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → shortest clear time in seconds. */
  bestSeconds: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → shortest clear time for that day. */
  dailySeconds: Record<string, number>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

/**
 * Malformed entries are dropped rather than rejecting the whole record: one
 * bad key must not cost the player their whole history. The smaller of two
 * values wins on a duplicate key, since the map holds bests.
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
  key: MJ_STORAGE_KEYS.progress,
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

// ---------- saved game ----------

/**
 * The largest layout holds 144 tiles = 72 pairs; coordinates are half-units
 * inside a small portrait window. Bounds here are shape sanity — the replay
 * in gamePersistence.ts is what decides possibility.
 */
const MAX_PAIRS = 72;
const MAX_COORD = 60;
const MAX_LAYER = 8;

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  /** 1..100 for level mode, null for daily. */
  level: number | null;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  dailyDate: string | null;
  /** Removed pairs in order: [x1,y1,z1,x2,y2,z2] per entry (§10). */
  removed: [number, number, number, number, number, number][];
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

function validateRemoved(raw: unknown): PersistedGame['removed'] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PAIRS) return null;
  const out: PersistedGame['removed'] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 6) return null;
    const pair: number[] = [];
    for (let i = 0; i < 6; i++) {
      const max = i % 3 === 2 ? MAX_LAYER : MAX_COORD;
      const value = asInt(entry[i], 0, max);
      if (value === null) return null;
      pair.push(value);
    }
    out.push(pair as [number, number, number, number, number, number]);
  }
  return out;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'level' || raw.mode === 'daily' ? raw.mode : null;
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const removed = validateRemoved(raw.removed);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    removed === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (level === null && raw.level !== null) return null;
  if (dailyDate === null && raw.dailyDate !== null) return null;
  // Identity must be exactly one of the two (§10): the level number or the
  // date is what the board is rebuilt from, so a record without its half of
  // the identity — or with the other mode's half — is corrupt.
  if (mode === 'level' && (level === null || dailyDate !== null)) return null;
  if (mode === 'daily' && (dailyDate === null || level !== null)) return null;

  return {
    schemaVersion: 1,
    mode,
    level,
    dailyDate,
    removed,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes.
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the `level` key loads happily, and resuming it
 * switches the app to the daily slot: the player asks for one game and is
 * shown the other one, or a blank screen where the other one isn't.
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

/** Suspended level game. */
export const gameSchema = gameSlotSchema(MJ_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(MJ_STORAGE_KEYS.dailyGame, 'daily');
