/**
 * Sliding Puzzle's own persisted records, under the `sp.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/SLIDING_PUZZLE_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { cellCount, isSize, MAX_LEVEL, SIZES, type GameMode, type Size } from '../game';

export const SP_STORAGE_KEYS = {
  game: 'sp.saveGame',
  dailyGame: 'sp.saveDaily',
  stats: 'sp.stats',
  progress: 'sp.progress',
  flags: 'sp.flags',
} as const;

/** Statistics are kept per board size (§9). */
export type SizeKey = `size${Size}`;
export const sizeKey = (size: Size): SizeKey => `size${size}`;

const asSize = (value: unknown): Size | null => (isSize(value) ? value : null);

/** The longest board string any size produces — one character per cell. */
const MAX_TILES_LENGTH = cellCount(SIZES[SIZES.length - 1] ?? 5);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SP_STORAGE_KEYS.flags,
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
  solved: number;
  totalPlaySeconds: number;
  /** Fewest moves in a solved game, or null before the first solve. */
  bestMoves: number | null;
  bestSeconds: number | null;
}

/** Per board size, plus nothing else: no streaks anywhere (§7, §9). */
export interface Stats {
  schemaVersion: 1;
  size3: SizeStats;
  size4: SizeStats;
  size5: SizeStats;
}

const emptySizeStats = (): SizeStats => ({
  played: 0,
  solved: 0,
  totalPlaySeconds: 0,
  bestMoves: null,
  bestSeconds: null,
});

const validateSizeStats = (raw: unknown): SizeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestMoves = raw.bestMoves === null ? null : asInt(raw.bestMoves, 0, 1e9);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestMoves === null && raw.bestMoves !== null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestMoves, bestSeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: SP_STORAGE_KEYS.stats,
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
  /** Highest level the player may start (1..999). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → fewest moves used to solve it. */
  bestMoves: Record<string, number>;
  /** Sparse map: level number (string) → shortest clear time in seconds. */
  bestSeconds: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → fewest moves for that day. */
  dailyMoves: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → shortest clear time for that day. */
  dailySeconds: Record<string, number>;
}

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

/**
 * Malformed entries are dropped rather than rejecting the whole record: one bad
 * key must not cost the player their whole history. The smaller of two values
 * wins on a duplicate key, since both maps hold bests.
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
    if (asDateString(key) !== null && amount !== null && Object.keys(out).length < MAX_DAILY_ENTRIES) {
      out[key] = amount;
    }
  }
  return out;
}

export const progressSchema: SchemaDef<Progress> = {
  key: SP_STORAGE_KEYS.progress,
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
  size: Size;
  dailyDate: string | null;
  level: number | null;
  tiles: string;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'level' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const size = asSize(raw.size);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  const tiles = asString(raw.tiles, MAX_TILES_LENGTH);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    size === null ||
    tiles === null ||
    moveCount === null ||
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
    size,
    dailyDate,
    level,
    tiles,
    moveCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape; the mode field inside the
 * record says which slot it belongs to (§10).
 */
function gameSlotSchema(key: string): SchemaDef<PersistedGame | null> {
  return { key, version: 1, defaultValue: () => null, validate: validatePersistedGame };
}

/** Suspended level game. */
export const gameSchema = gameSlotSchema(SP_STORAGE_KEYS.game);
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(SP_STORAGE_KEYS.dailyGame);
