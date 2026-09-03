/**
 * Nonogram's own persisted records, under the `ng.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/NONOGRAM_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  cellCount,
  isFreeTier,
  isSize,
  MAX_LEVEL,
  SIZES,
  type FreeTier,
  type GameMode,
  type Size,
} from '../game';

import { NG_STORAGE_KEYS } from './keys';

export { NG_STORAGE_KEYS };

/** Statistics are kept per board size (§9). */
export type SizeKey = `size${Size}`;
export const sizeKey = (size: Size): SizeKey => `size${size}`;

const asSize = (value: unknown): Size | null => (isSize(value) ? value : null);

/** The longest board string any size produces — one character per cell. */
const MAX_BOARD_LENGTH = cellCount(SIZES[SIZES.length - 1] ?? 5);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: NG_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/** The cross-mode toggle of §3 — a play preference, owned by this game. */
export interface Prefs {
  schemaVersion: 1;
  xMode: boolean;
  /** The tier the Free Play picker last stood on (§6「フリープレイ」). */
  freeTier: FreeTier;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: NG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, xMode: false, freeTier: 'medium' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const xMode = asBool(raw.xMode);
    if (xMode === null) return null;
    // Added after release: a record without it is older, not corrupt, and
    // the picker simply starts where a fresh install would.
    const freeTier =
      raw.freeTier === undefined ? 'medium' : isFreeTier(raw.freeTier) ? raw.freeTier : null;
    if (freeTier === null) return null;
    return { schemaVersion: 1, xMode, freeTier };
  },
};

// ---------- statistics ----------

export interface SizeStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/** Per board size, plus nothing else: no streaks anywhere (§6, §9). */
export interface Stats {
  schemaVersion: 1;
  size5: SizeStats;
  size10: SizeStats;
}

const emptySizeStats = (): SizeStats => ({
  played: 0,
  solved: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
});

const validateSizeStats = (raw: unknown): SizeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: NG_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    size5: emptySizeStats(),
    size10: emptySizeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const size5 = validateSizeStats(raw.size5);
    const size10 = validateSizeStats(raw.size10);
    if (size5 === null || size10 === null) return null;
    return { schemaVersion: 1, size5, size10 };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 2;
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
  key: NG_STORAGE_KEYS.progress,
  version: 2,
  defaultValue: () => ({
    schemaVersion: 2,
    highestUnlocked: 1,
    bestSeconds: {},
    dailySeconds: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;

    // v1 → v2: the level list went from 999 levels to 100 (§6), which changed
    // what every level number means and every board behind it. Level progress
    // starts over rather than being reinterpreted: a best time carried across
    // would stand against a board that no longer exists, and a level number
    // rescaled onto the new list would unlock a puzzle nobody has played. The
    // daily calendar survives untouched — dailies are a fixed size and fill
    // rate, so their boards and their times are exactly as they were.
    if (raw.schemaVersion === 1) {
      return {
        schemaVersion: 2,
        highestUnlocked: 1,
        bestSeconds: {},
        dailySeconds: validateDailyMap(raw.dailySeconds),
      };
    }

    if (raw.schemaVersion !== 2) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null) return null;
    return {
      schemaVersion: 2,
      highestUnlocked,
      bestSeconds: validateLevelMap(raw.bestSeconds),
      dailySeconds: validateDailyMap(raw.dailySeconds),
    };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  size: Size;
  dailyDate: string | null;
  level: number | null;
  freeTier: FreeTier | null;
  solution: string;
  marks: string;
  elapsedSeconds: number;
  hintCount: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode =
    raw.mode === 'level' || raw.mode === 'daily' || raw.mode === 'free' ? raw.mode : null;
  const seed = asString(raw.seed);
  const size = asSize(raw.size);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  // Joined the record with Free Play: a level or a daily saved before then
  // simply has no field, which reads the same as the null it writes now.
  const freeTier = isFreeTier(raw.freeTier) ? raw.freeTier : null;
  const solution = asString(raw.solution, MAX_BOARD_LENGTH);
  const marks = asString(raw.marks, MAX_BOARD_LENGTH);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    size === null ||
    solution === null ||
    marks === null ||
    elapsedSeconds === null ||
    hintCount === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (level === null && raw.level !== null) return null;
  if (freeTier === null && raw.freeTier !== undefined && raw.freeTier !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'level' && level === null) return null;
  // A free board is drawn at a tier and is about neither a level nor a date.
  if (mode === 'free' && (freeTier === null || level !== null || dailyDate !== null)) return null;
  if (mode !== 'free' && freeTier !== null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    size,
    dailyDate,
    level,
    freeTier,
    solution,
    marks,
    elapsedSeconds,
    hintCount,
    savedAt,
  };
};

/**
 * One slot per mode. All hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes.
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the `level` key loads happily, and resuming
 * it switches the app to the daily slot: the player asks for one game and
 * is shown the other one, or a blank screen where the other one isn't.
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
export const gameSchema = gameSlotSchema(NG_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(NG_STORAGE_KEYS.dailyGame, 'daily');
/** Suspended free board (§6「フリープレイ」): its own slot, for the same reason. */
export const freeGameSchema = gameSlotSchema(NG_STORAGE_KEYS.freeGame, 'free');
