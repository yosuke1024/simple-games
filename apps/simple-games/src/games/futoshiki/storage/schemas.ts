/**
 * Futoshiki's own persisted records, under the `ft.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/FUTOSHIKI_RULES.md §11).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  cellCount,
  FREE_TIER_LEVEL,
  isFreeTier,
  isSize,
  MAX_LEVEL,
  SIZES,
  sizeForLevel,
  type FreeTier,
  type GameMode,
  type Size,
} from '../game';

import { FT_STORAGE_KEYS } from './keys';

export { FT_STORAGE_KEYS };

/** Statistics are kept per board size (§10). */
export type SizeKey = `size${Size}`;
export const sizeKey = (size: Size): SizeKey => `size${size}`;

const asSize = (value: unknown): Size | null => (isSize(value) ? value : null);
const asFreeTier = (value: unknown): FreeTier | null => (isFreeTier(value) ? value : null);

/** The longest grid string any size produces — one character per cell. */
const MAX_GRID_LENGTH = cellCount(SIZES[SIZES.length - 1] ?? 7);

/**
 * The widest the encoded notes get: one base-32 mask per cell, and seven bits
 * never needs more than two characters, plus a separator each.
 */
const MAX_NOTES_LENGTH = MAX_GRID_LENGTH * 3;

/**
 * The widest the sign list gets: at most `2 * N * (N - 1)` gaps exist on an
 * N×N board, and a token is a cell index, a gap letter, a symbol and a comma.
 */
const MAX_CONSTRAINTS_LENGTH = 2 * 7 * 6 * 5;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: FT_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- preferences ----------

/**
 * What this game remembers across boards (§5, §9). Marking a digit that
 * disagrees with the answer the moment it lands helps most players and is on
 * by default; turning it off is for players who would rather find their own
 * mistakes. The violation display is not in here — that is a rule, not an
 * option (§5), and it is on either way. The Free Play tier is where the
 * picker last stood, so the next launch starts from the same place.
 */
export interface Prefs {
  schemaVersion: 1;
  highlightMistakes: boolean;
  /** The tier the Free Play picker last stood on (§9「フリープレイ」). */
  freeTier: FreeTier;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: FT_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, highlightMistakes: true, freeTier: 'medium' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highlightMistakes = asBool(raw.highlightMistakes);
    if (highlightMistakes === null) return null;
    // Added after release: a record without it is older, not corrupt, and
    // the picker simply starts where a fresh install would.
    const freeTier = raw.freeTier === undefined ? 'medium' : asFreeTier(raw.freeTier);
    if (freeTier === null) return null;
    return { schemaVersion: 1, highlightMistakes, freeTier };
  },
};

// ---------- statistics ----------

export interface SizeStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * Per board size, and per nothing else (§10). Not per tier: what a player
 * picks is a level number, so a table cut by tier would be a table cut by an
 * axis nobody chooses. Mistakes and hints are shown on the clear screen and
 * never accumulated here (§5, §6).
 */
export interface Stats {
  schemaVersion: 1;
  size4: SizeStats;
  size5: SizeStats;
  size6: SizeStats;
  size7: SizeStats;
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
  key: FT_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    size4: emptySizeStats(),
    size5: emptySizeStats(),
    size6: emptySizeStats(),
    size7: emptySizeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const size4 = validateSizeStats(raw.size4);
    const size5 = validateSizeStats(raw.size5);
    const size6 = validateSizeStats(raw.size6);
    const size7 = validateSizeStats(raw.size7);
    if (size4 === null || size5 === null || size6 === null || size7 === null) return null;
    return { schemaVersion: 1, size4, size5, size6, size7 };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..100). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → shortest clear time in seconds. */
  bestSeconds: Record<string, number>;
  /**
   * Sparse map: daily date (YYYY-MM-DD) → shortest clear time for that day.
   * Which days were solved is read off this map; there is no calendar record
   * of its own, and no streak to keep (§9, §10).
   */
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
  key: FT_STORAGE_KEYS.progress,
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
 * One suspended game (§11). The answer, the signs and three grids travel as
 * strings, because keeping the puzzle's digits apart from the player's is what
 * lets §11 state "an entry on top of a given" as corruption the loader can
 * name rather than a state nobody thought about.
 *
 * The undo history is not here, on purpose (§5): it is by far the largest
 * thing a session holds and the one thing nobody misses on resume.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  size: Size;
  dailyDate: string | null;
  level: number | null;
  /** The tier a free board was drawn at (§9); null for a level or a daily. */
  freeTier: FreeTier | null;
  solution: string;
  constraints: string;
  givens: string;
  entries: string;
  notes: string;
  mistakeCount: number;
  hintCount: number;
  elapsedSeconds: number;
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
  // Free Play joined after release (§9): a level or daily record without the
  // field is older, not corrupt.
  const freeTier =
    raw.freeTier === undefined || raw.freeTier === null ? null : asFreeTier(raw.freeTier);
  const solution = asString(raw.solution, MAX_GRID_LENGTH);
  const constraints = asString(raw.constraints, MAX_CONSTRAINTS_LENGTH);
  const givens = asString(raw.givens, MAX_GRID_LENGTH);
  const entries = asString(raw.entries, MAX_GRID_LENGTH);
  const notes = asString(raw.notes, MAX_NOTES_LENGTH);
  const mistakeCount = asInt(raw.mistakeCount, 0, 1e6);
  const hintCount = asInt(raw.hintCount, 0, 1e6);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    size === null ||
    solution === null ||
    constraints === null ||
    givens === null ||
    entries === null ||
    notes === null ||
    mistakeCount === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (level === null && raw.level !== null) return null;
  if (freeTier === null && raw.freeTier !== undefined && raw.freeTier !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'level' && level === null) return null;
  // A free board has neither a level number nor a date to be about, and it
  // carries the tier it was drawn at; a level or a daily carries no tier.
  if (mode === 'free' && (level !== null || dailyDate !== null || freeTier === null)) return null;
  if (mode !== 'free' && freeTier !== null) return null;
  // The tier is a level's parameters, and that level says the size (§9): a
  // record whose size disagrees with its tier never came from play.
  if (freeTier !== null && sizeForLevel(FREE_TIER_LEVEL[freeTier]) !== size) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    size,
    dailyDate,
    level,
    freeTier,
    solution,
    constraints,
    givens,
    entries,
    notes,
    mistakeCount,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. All hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (§11).
 *
 * That is the whole point of passing the expected mode in. Without it, a
 * daily record sitting in the `level` key loads happily, and resuming it
 * switches the app to the daily slot: the player asks for one game and is
 * shown the other one, or a blank screen where the other one isn't.
 *
 * What the five board strings hold is checked one layer out, by `decodeGame`
 * in the game itself (§11): a Latin square, signs that agree with it, givens
 * that agree with it, no entry on a given and no note under a digit. The rules
 * of §3 have one implementation, and a second copy here would be a second
 * thing that has to stay true.
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
export const gameSchema = gameSlotSchema(FT_STORAGE_KEYS.game, 'level');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(FT_STORAGE_KEYS.dailyGame, 'daily');
/** Suspended free board (§9「フリープレイ」): its own slot, for the same reason. */
export const freeGameSchema = gameSlotSchema(FT_STORAGE_KEYS.freeGame, 'free');
