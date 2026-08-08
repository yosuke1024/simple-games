/**
 * Takuzu's own persisted records, under the `tk.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/TAKUZU_RULES.md §11).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asDateString, asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { cellCount, isSize, MAX_LEVEL, SIZES, type GameMode, type Size } from '../game';

import { TK_STORAGE_KEYS } from './keys';

export { TK_STORAGE_KEYS };

/** Statistics are kept per board size (§10). */
export type SizeKey = `size${Size}`;
export const sizeKey = (size: Size): SizeKey => `size${size}`;

const asSize = (value: unknown): Size | null => (isSize(value) ? value : null);

/** The longest board string any size produces — one character per cell. */
const MAX_BOARD_LENGTH = cellCount(SIZES[SIZES.length - 1] ?? 10);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: TK_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// There is no prefs record. Takuzu has nothing to prefer: one gesture does
// everything (§4) and the violation display is a rule rather than an option
// (§9), so the five keys of storage/keys.ts are the whole of it.

// ---------- statistics ----------

export interface SizeStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/** Per board size, plus nothing else: no streaks anywhere (§7, §10). */
export interface Stats {
  schemaVersion: 1;
  size6: SizeStats;
  size8: SizeStats;
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
  key: TK_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    size6: emptySizeStats(),
    size8: emptySizeStats(),
    size10: emptySizeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const size6 = validateSizeStats(raw.size6);
    const size8 = validateSizeStats(raw.size8);
    const size10 = validateSizeStats(raw.size10);
    if (size6 === null || size8 === null || size10 === null) return null;
    return { schemaVersion: 1, size6, size8, size10 };
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
  key: TK_STORAGE_KEYS.progress,
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
 * One suspended game (§11). Three boards travel as strings — the solution, the
 * fixed cells, and what the player wrote — because keeping the player's digits
 * apart from the puzzle's is what makes "a mark on top of a given" corruption
 * the loader can name rather than a state nobody thought about.
 *
 * There is no mistakeCount, and not because it was forgotten: this game has no
 * mistake to count (§9, §14). A digit that is legal but not final is not wrong
 * yet, and the always-on violation display says everything there is to say.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  size: Size;
  dailyDate: string | null;
  level: number | null;
  givens: string;
  solution: string;
  marks: string;
  hintCount: number;
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
  const givens = asString(raw.givens, MAX_BOARD_LENGTH);
  const solution = asString(raw.solution, MAX_BOARD_LENGTH);
  const marks = asString(raw.marks, MAX_BOARD_LENGTH);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    size === null ||
    givens === null ||
    solution === null ||
    marks === null ||
    hintCount === null ||
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
    givens,
    solution,
    marks,
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
 * daily record sitting in the `level` key loads happily, and resuming
 * it switches the app to the daily slot: the player asks for one game and
 * is shown the other one, or a blank screen where the other one isn't.
 *
 * What the three board strings hold is checked one layer out, by
 * `decodeBoards` in gamePersistence (§11): the rules of §3 have one
 * implementation, in the game, and a second copy here would be a second thing
 * that has to stay true.
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
export const gameSchema = gameSlotSchema(TK_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(TK_STORAGE_KEYS.dailyGame, 'daily');
