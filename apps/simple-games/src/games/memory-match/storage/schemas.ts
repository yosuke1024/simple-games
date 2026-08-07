/**
 * Memory Match's own persisted records, under the `mm.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/MEMORY_MATCH_RULES.md §10).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { cellCount, isDifficulty, LAYOUTS, type Difficulty, type GameMode } from '../game';

import { MM_STORAGE_KEYS } from './keys';

export { MM_STORAGE_KEYS };

/** The longest board string any difficulty produces — one character per cell. */
const MAX_BOARD_LENGTH = cellCount(LAYOUTS.hard);

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: MM_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

export interface DifficultyStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  /** Fewest moves in a completed game, or null before the first completion. */
  bestMoves: number | null;
  bestSeconds: number | null;
}

/**
 * Per difficulty, plus the days the daily was completed (§9). The daily
 * record is which days and in how many moves — a count, never a streak (§7).
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  /** Sparse map: YYYY-MM-DD → fewest moves for that day. */
  dailyMoves: Record<string, number>;
  /** Sparse map: YYYY-MM-DD → shortest clear time for that day. */
  dailySeconds: Record<string, number>;
}

const emptyDifficultyStats = (): DifficultyStats => ({
  played: 0,
  solved: 0,
  totalPlaySeconds: 0,
  bestMoves: null,
  bestSeconds: null,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
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

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

/**
 * Malformed entries are dropped rather than rejecting the whole record: one
 * bad key must not cost the player their whole history.
 */
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

export const statsSchema: SchemaDef<Stats> = {
  key: MM_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    dailyMoves: {},
    dailySeconds: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    if (easy === null || medium === null || hard === null) return null;
    return {
      schemaVersion: 1,
      easy,
      medium,
      hard,
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
  difficulty: Difficulty;
  dailyDate: string | null;
  /** Base-36 symbol per cell (serialize.ts). */
  deck: string;
  /** '0'/'1' per cell. */
  matched: string;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const deck = asString(raw.deck, MAX_BOARD_LENGTH);
  const matched = asString(raw.matched, MAX_BOARD_LENGTH);
  const moveCount = asInt(raw.moveCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    deck === null ||
    matched === null ||
    moveCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'difficulty' && dailyDate !== null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    deck,
    matched,
    moveCount,
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
 * daily record sitting in the `difficulty` key loads happily, and resuming
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

/** Suspended difficulty game. */
export const gameSchema = gameSlotSchema(MM_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(MM_STORAGE_KEYS.dailyGame, 'daily');
