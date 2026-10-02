/**
 * Water Sort's own persisted records, under the `ws.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/WATER_SORT_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  FREE_TIERS,
  MAX_COLORS,
  MAX_LEVEL,
  MIN_COLORS,
  tubeCount,
  TUBE_CAPACITY,
  type FreeTier,
  type GameMode,
} from '../game';

import { WS_STORAGE_KEYS } from './keys';

export { WS_STORAGE_KEYS };

/** The longest board string possible: every unit plus the tube separators. */
const MAX_TUBES_LENGTH = MAX_COLORS * TUBE_CAPACITY + tubeCount(MAX_COLORS);

const asFreeTier = (value: unknown): FreeTier | null =>
  FREE_TIERS.includes(value as FreeTier) ? (value as FreeTier) : null;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: WS_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

export interface Prefs {
  schemaVersion: 1;
  /** The tier the Free Play picker last stood on (§6「フリープレイ」). */
  freeTier: FreeTier;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: WS_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, freeTier: 'medium' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    // A record without the field is older, not corrupt: the picker simply
    // starts where a fresh install would.
    const freeTier = raw.freeTier === undefined ? 'medium' : asFreeTier(raw.freeTier);
    return freeTier === null ? null : { schemaVersion: 1, freeTier };
  },
};

// ---------- statistics ----------

/**
 * One global bucket (§9): the color count is the level curve, not a mode a
 * player picks, so per-color buckets would slice the same journey seven ways.
 * Per-level bests live in Progress.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  solved: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: WS_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0, solved: 0, totalPlaySeconds: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const solved = asInt(raw.solved, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (played === null || solved === null || totalPlaySeconds === null) return null;
    return { schemaVersion: 1, played, solved, totalPlaySeconds };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..999). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → fewest pours used to solve it. */
  bestMoves: Record<string, number>;
  /** Sparse map: level number (string) → shortest clear time in seconds. */
  bestSeconds: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → fewest pours for that day. */
  dailyMoves: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → shortest clear time for that day. */
  dailySeconds: Record<string, number>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

/**
 * Malformed entries are dropped rather than rejecting the whole record: one
 * bad key must not cost the player their whole history. The smaller of two
 * values wins on a duplicate key, since both maps hold bests.
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
  key: WS_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    highestUnlocked: 1,
    bestMoves: {},
    bestSeconds: {},
    dailyMoves: {},
    dailySeconds: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null) return null;
    return {
      schemaVersion: 1,
      highestUnlocked,
      bestMoves: validateLevelMap(raw.bestMoves),
      bestSeconds: validateLevelMap(raw.bestSeconds),
      dailyMoves: validateDailyMap(raw.dailyMoves),
      dailySeconds: validateDailyMap(raw.dailySeconds),
    };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  colors: number;
  dailyDate: string | null;
  level: number | null;
  /** Set for a free board only (§6「フリープレイ」). */
  freeTier: FreeTier | null;
  /** Base-36 units bottom-to-top, tubes joined by '.' (serialize.ts). */
  tubes: string;
  moveCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode =
    raw.mode === 'level' || raw.mode === 'daily' || raw.mode === 'free' ? raw.mode : null;
  const seed = asString(raw.seed);
  const colors = asInt(raw.colors, MIN_COLORS, MAX_COLORS);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  // Free play came after release: a level or a daily saved before it has no
  // tier field at all, and that is an older record, not a broken one.
  const rawTier = raw.freeTier ?? null;
  const freeTier = rawTier === null ? null : asFreeTier(rawTier);
  const tubes = asString(raw.tubes, MAX_TUBES_LENGTH);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    colors === null ||
    tubes === null ||
    moveCount === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (level === null && raw.level !== null) return null;
  if (freeTier === null && rawTier !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'level' && level === null) return null;
  // A free board has neither a level number nor a date to be about, and only
  // a free board has a tier.
  if (mode === 'free' && (level !== null || dailyDate !== null || freeTier === null)) return null;
  if (mode !== 'free' && freeTier !== null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    colors,
    dailyDate,
    level,
    freeTier,
    tubes,
    moveCount,
    hintCount,
    elapsedSeconds,
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
export const gameSchema = gameSlotSchema(WS_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(WS_STORAGE_KEYS.dailyGame, 'daily');
/** Suspended free board (§6「フリープレイ」): its own slot, for the same reason. */
export const freeGameSchema = gameSlotSchema(WS_STORAGE_KEYS.freeGame, 'free');
