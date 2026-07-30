/**
 * 2048's own persisted records, under the `g2048.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Inside a record, one malformed entry is dropped rather than
 * failing the whole record — a single bad key must not cost the player their
 * history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { CELLS, MAX_EXPONENT, type GameMode } from '../game';

export const G2048_STORAGE_KEYS = {
  game: 'g2048.saveGame',
  dailyGame: 'g2048.saveDaily',
  stats: 'g2048.stats',
  progress: 'g2048.progress',
  flags: 'g2048.flags',
} as const;

/** The largest tile a 4x4 board can hold — anything above it is corruption. */
const MAX_TILE_VALUE = 2 ** MAX_EXPONENT;
/** Sixteen squares of 131072 cannot score more than this many points. */
const MAX_SCORE = 1e9;
/** Enough daily dates for years of play; a longer map is a runaway, not history. */
const MAX_DAILY_ENTRIES = 2000;

const asMode = (value: unknown): GameMode | null =>
  value === 'classic' || value === 'daily' ? value : null;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: G2048_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/**
 * What §8 asks to be kept, per mode: how often it was played, the best score,
 * the highest tile ever reached, how many times 2048 was made, and total play
 * time. No streak, and nothing that counts consecutive days.
 */
export interface ModeStats {
  played: number;
  bestScore: number;
  bestTile: number;
  wins: number;
  totalPlaySeconds: number;
}

export interface Stats {
  schemaVersion: 1;
  classic: ModeStats;
  daily: ModeStats;
}

const emptyModeStats = (): ModeStats => ({
  played: 0,
  bestScore: 0,
  bestTile: 0,
  wins: 0,
  totalPlaySeconds: 0,
});

const validateModeStats = (raw: unknown): ModeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const bestScore = asInt(raw.bestScore, 0, MAX_SCORE);
  const bestTile = asInt(raw.bestTile, 0, MAX_TILE_VALUE);
  const wins = asInt(raw.wins, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  if (played === null || bestScore === null || bestTile === null) return null;
  if (wins === null || totalPlaySeconds === null) return null;
  return { played, bestScore, bestTile, wins, totalPlaySeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: G2048_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    classic: emptyModeStats(),
    daily: emptyModeStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const classic = validateModeStats(raw.classic);
    const daily = validateModeStats(raw.daily);
    if (classic === null || daily === null) return null;
    return { schemaVersion: 1, classic, daily };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Sparse map: daily date (YYYY-MM-DD) → best score on that day (§6). */
  dailyScores: Record<string, number>;
}

export const progressSchema: SchemaDef<Progress> = {
  key: G2048_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, dailyScores: {} }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1 || !isRecord(raw.dailyScores)) return null;

    const dailyScores: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw.dailyScores)) {
      const score = asInt(value, 0, MAX_SCORE);
      if (asDateString(key) === null || score === null) continue;
      if (Object.keys(dailyScores).length >= MAX_DAILY_ENTRIES) break;
      dailyScores[key] = score;
    }

    return { schemaVersion: 1, dailyScores };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  dailyDate: string | null;
  /** The board as one base-36 exponent per square (see game/serialize.ts). */
  board: string;
  score: number;
  moveCount: number;
  spawnCount: number;
  won: boolean;
  winAcknowledged: boolean;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = asMode(raw.mode);
  const seed = asString(raw.seed);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const board = asString(raw.board, CELLS);
  const score = asInt(raw.score, 0, MAX_SCORE);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const spawnCount = asInt(raw.spawnCount, 0, 1e9);
  const won = asBool(raw.won);
  const winAcknowledged = asBool(raw.winAcknowledged);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    board === null ||
    board.length !== CELLS ||
    score === null ||
    moveCount === null ||
    spawnCount === null ||
    won === null ||
    winAcknowledged === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  // A daily without its date could not be rebuilt, and a classic game with one
  // never existed.
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'classic' && dailyDate !== null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    dailyDate,
    board,
    score,
    moveCount,
    spawnCount,
    won,
    winAcknowledged,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape; the mode field inside
 * the record says which slot it belongs to (§6).
 */
function gameSlotSchema(key: string): SchemaDef<PersistedGame | null> {
  return { key, version: 1, defaultValue: () => null, validate: validatePersistedGame };
}

/** Suspended classic game. */
export const gameSchema = gameSlotSchema(G2048_STORAGE_KEYS.game);
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(G2048_STORAGE_KEYS.dailyGame);
