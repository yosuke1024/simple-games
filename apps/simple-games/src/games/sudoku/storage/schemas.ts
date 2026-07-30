/**
 * Sudoku's own persisted records, under the `sd.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/SUDOKU_RULES.md §11).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { CELLS, DIFFICULTIES, MAX_LEVEL, type Difficulty, type GameMode } from '../game';

export const SD_STORAGE_KEYS = {
  game: 'sd.saveGame',
  dailyGame: 'sd.saveDaily',
  stats: 'sd.stats',
  progress: 'sd.progress',
  flags: 'sd.flags',
  prefs: 'sd.prefs',
} as const;

const asDifficulty = (value: unknown): Difficulty | null =>
  DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : null;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: SD_STORAGE_KEYS.flags,
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
 * Sudoku's own settings. Highlighting a wrong digit the moment it lands helps
 * most players and is on by default (§4); turning it off is for players who
 * want to find their own mistakes.
 */
export interface Prefs {
  schemaVersion: 1;
  highlightMistakes: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: SD_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, highlightMistakes: true }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highlightMistakes = asBool(raw.highlightMistakes);
    return highlightMistakes === null ? null : { schemaVersion: 1, highlightMistakes };
  },
};

// ---------- statistics ----------

export interface DifficultyStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
  totalSolvedSeconds: number;
}

/** Per difficulty, plus nothing else: no streaks anywhere (§10, §12). */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
}

const emptyDifficultyStats = (): DifficultyStats => ({
  played: 0,
  solved: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
  totalSolvedSeconds: 0,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  // Added after the first release would have shipped; absent means zero rather
  // than corrupt, so an existing record keeps its counts.
  const totalSolvedSeconds = asInt(raw.totalSolvedSeconds ?? 0, 0, 1e12);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  if (totalSolvedSeconds === null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds, totalSolvedSeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: SD_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    if (easy === null || medium === null || hard === null) return null;
    return { schemaVersion: 1, easy, medium, hard };
  },
};

// ---------- progress ----------

export interface Progress {
  schemaVersion: 1;
  /** Highest level the player may start (1..999). */
  highestUnlocked: number;
  /** Sparse map: level number (string) → best clear time in seconds. */
  bestTimes: Record<string, number>;
  /** Sparse map: daily date (YYYY-MM-DD) → best clear time for that day. */
  dailyTimes: Record<string, number>;
}

export const progressSchema: SchemaDef<Progress> = {
  key: SD_STORAGE_KEYS.progress,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    highestUnlocked: 1,
    bestTimes: {},
    dailyTimes: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highestUnlocked = asInt(raw.highestUnlocked, 1, MAX_LEVEL);
    if (highestUnlocked === null || !isRecord(raw.bestTimes)) return null;

    // Malformed entries are dropped rather than rejecting the whole record: one
    // bad key must not cost the player their whole history.
    const bestTimes: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw.bestTimes)) {
      const level = /^\d{1,3}$/.test(key) ? Number(key) : NaN;
      const seconds = asInt(value, 0, 1e9);
      if (level >= 1 && level <= MAX_LEVEL && seconds !== null) {
        const existing = bestTimes[String(level)];
        bestTimes[String(level)] = existing === undefined ? seconds : Math.min(existing, seconds);
      }
    }

    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, 1e9);
        if (asDateString(key) !== null && seconds !== null && Object.keys(dailyTimes).length < 2000) {
          dailyTimes[key] = seconds;
        }
      }
    }

    return { schemaVersion: 1, highestUnlocked, bestTimes, dailyTimes };
  },
};

// ---------- saved game ----------

export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  level: number | null;
  givens: string;
  entries: string;
  notes: string;
  solution: string;
  mistakeCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'level' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const level = raw.level === null ? null : asInt(raw.level, 1, MAX_LEVEL);
  const givens = asString(raw.givens, CELLS);
  const entries = asString(raw.entries, CELLS);
  // Nine bits in base 32 is at most two characters, plus a separator each.
  const notes = asString(raw.notes, CELLS * 3);
  const solution = asString(raw.solution, CELLS);
  const mistakeCount = asInt(raw.mistakeCount, 0, 1e6);
  const hintCount = asInt(raw.hintCount, 0, 1e6);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    givens === null ||
    entries === null ||
    notes === null ||
    solution === null ||
    mistakeCount === null ||
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
    difficulty,
    dailyDate,
    level,
    givens,
    entries,
    notes,
    solution,
    mistakeCount,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape; the mode field inside
 * the record says which slot it belongs to (§11).
 */
function gameSlotSchema(key: string): SchemaDef<PersistedGame | null> {
  return { key, version: 1, defaultValue: () => null, validate: validatePersistedGame };
}

/** Suspended level game. */
export const gameSchema = gameSlotSchema(SD_STORAGE_KEYS.game);
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(SD_STORAGE_KEYS.dailyGame);
