/**
 * Minesweeper's own persisted records, under the `ms.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never take
 * the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/MINESWEEPER_RULES.md §10). Where a record holds a map of
 * results, a malformed entry is dropped rather than costing the player the
 * whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { DIFFICULTIES, PRESETS, type Difficulty, type GameMode } from '../game';

import { MS_STORAGE_KEYS } from './keys';

export { MS_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null =>
  DIFFICULTIES.includes(value as Difficulty) ? (value as Difficulty) : null;

/** The largest board, plus room for a future one — the cap on a cell string. */
const MAX_CELLS = 1024;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: MS_STORAGE_KEYS.flags,
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
 * Minesweeper's own settings. Flag mode swaps what a tap and a long press do
 * (§3); it is off by default because tap-to-open is what the game is, and it
 * exists so that long-pressing is never the only way to plant a flag.
 */
export interface Prefs {
  schemaVersion: 1;
  flagMode: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: MS_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, flagMode: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const flagMode = asBool(raw.flagMode);
    return flagMode === null ? null : { schemaVersion: 1, flagMode };
  },
};

// ---------- statistics ----------

export interface DifficultyStats {
  played: number;
  won: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * Per difficulty, plus the days the daily was cleared (§9). The daily record is
 * a set of dates, never a run of them: there is no streak anywhere in this app.
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  /** Sparse map: YYYY-MM-DD → best clear time in seconds for that day. */
  dailyTimes: Record<string, number>;
}

const emptyDifficultyStats = (): DifficultyStats => ({
  played: 0,
  won: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const won = asInt(raw.won, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || won === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, won, totalPlaySeconds, bestSeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: MS_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    dailyTimes: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    if (easy === null || medium === null || hard === null) return null;

    // One unreadable date must not cost the player every other day they
    // cleared, so bad entries are dropped rather than failing the record.
    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, 1e9);
        if (
          asDateString(key) !== null &&
          seconds !== null &&
          Object.keys(dailyTimes).length < 2000
        ) {
          dailyTimes[key] = seconds;
        }
      }
    }

    return { schemaVersion: 1, easy, medium, hard, dailyTimes };
  },
};

// ---------- saved game ----------

/**
 * A suspended game (§10): the mine layout, what is open, what is flagged, the
 * clock, the seed, and whether the first tap has happened yet.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  /** The cell that placed the mines, or null before the first tap. */
  firstIndex: number | null;
  width: number;
  height: number;
  mines: string;
  opened: string;
  flagged: string;
  exploded: number | null;
  elapsedSeconds: number;
  hintCount: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const width = asInt(raw.width, 1, 64);
  const height = asInt(raw.height, 1, 64);
  const mines = asString(raw.mines, MAX_CELLS);
  const opened = asString(raw.opened, MAX_CELLS);
  const flagged = asString(raw.flagged, MAX_CELLS);
  const firstIndex = raw.firstIndex === null ? null : asInt(raw.firstIndex, 0, MAX_CELLS - 1);
  const exploded = raw.exploded === null ? null : asInt(raw.exploded, 0, MAX_CELLS - 1);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e6);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    width === null ||
    height === null ||
    mines === null ||
    opened === null ||
    flagged === null ||
    elapsedSeconds === null ||
    hintCount === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (firstIndex === null && raw.firstIndex !== null) return null;
  if (exploded === null && raw.exploded !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;

  // The board must be the shape the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  const preset = PRESETS[difficulty];
  if (width !== preset.width || height !== preset.height) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    firstIndex,
    width,
    height,
    mines,
    opened,
    flagged,
    exploded,
    elapsedSeconds,
    hintCount,
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
export const gameSchema = gameSlotSchema(MS_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(MS_STORAGE_KEYS.dailyGame, 'daily');
