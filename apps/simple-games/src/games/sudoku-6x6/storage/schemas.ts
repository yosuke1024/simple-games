/**
 * Sudoku 6×6's own persisted records, under the `s6.` prefix. Isolated from
 * the shared records and from every other game — the 9×9 Sudoku included
 * (docs/SUDOKU_6X6_RULES.md §14): corruption here can never take the shell or
 * another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (§11). Where a record holds a map of results, a malformed
 * entry is dropped rather than costing the player the whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { CELLS, DAILY_DIFFICULTY, isDifficulty, type Difficulty, type GameMode } from '../game';

import { S6_STORAGE_KEYS } from './keys';

export { S6_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: S6_STORAGE_KEYS.flags,
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
 * The difficulty last picked (§9) — it leads the home next time — and whether
 * a wrong digit is marked the moment it lands (§4, on by default). The second
 * is this game's one setting, edited from the shared settings screen
 * (ui/Sudoku6x6SettingsSection.tsx).
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
  highlightMistakes: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: S6_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy', highlightMistakes: true }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const highlightMistakes = asBool(raw.highlightMistakes);
    if (!isDifficulty(raw.difficulty) || highlightMistakes === null) return null;
    return { schemaVersion: 1, difficulty: raw.difficulty, highlightMistakes };
  },
};

// ---------- statistics ----------

export interface DifficultyStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * Per difficulty, plus the days the daily was solved (§10). The daily record
 * is a set of dates, never a run of them: there is no streak anywhere here.
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
  solved: 0,
  totalPlaySeconds: 0,
  bestSeconds: null,
});

const validateDifficultyStats = (raw: unknown): DifficultyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const solved = asInt(raw.solved, 0, 1e9);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, 1e9);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds };
};

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

export const statsSchema: SchemaDef<Stats> = {
  key: S6_STORAGE_KEYS.stats,
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
    // solved, so bad entries are dropped rather than failing the record.
    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, 1e9);
        if (
          asDateString(key) !== null &&
          seconds !== null &&
          Object.keys(dailyTimes).length < MAX_DAILY_ENTRIES
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
 * One suspended game (§11): three 36-character boards, 36 note masks and the
 * counters. No undo history — a resumed game starts with an empty one (§4).
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  givens: string;
  solution: string;
  entries: string;
  notes: number[];
  mistakeCount: number;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validateNotes = (raw: unknown): number[] | null => {
  if (!Array.isArray(raw) || raw.length !== CELLS) return null;
  const notes: number[] = [];
  for (const value of raw) {
    const mask = asInt(value, 0, 63);
    if (mask === null) return null;
    notes.push(mask);
  }
  return notes;
};

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = isDifficulty(raw.difficulty) ? raw.difficulty : null;
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const givens = asString(raw.givens, CELLS);
  const solution = asString(raw.solution, CELLS);
  const entries = asString(raw.entries, CELLS);
  const notes = validateNotes(raw.notes);
  const mistakeCount = asInt(raw.mistakeCount, 0, 1e9);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    givens === null ||
    solution === null ||
    entries === null ||
    notes === null ||
    mistakeCount === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  // Every board string is exactly one character per cell (§11).
  if (givens.length !== CELLS || solution.length !== CELLS || entries.length !== CELLS) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  // A daily has a date and is always medium; only a daily has a date (§9, §11).
  if (mode === 'daily' && dailyDate === null) return null;
  if (dailyDate !== null && (mode !== 'daily' || difficulty !== DAILY_DIFFICULTY)) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    givens,
    solution,
    entries,
    notes,
    mistakeCount,
    hintCount,
    elapsedSeconds,
    savedAt,
  };
};

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is corrupt
 * data, not an instruction to switch modes (§11). Without the expected mode, a
 * daily record sitting in the difficulty key would load, and resuming it would
 * show the player the other game.
 *
 * What the board strings hold is checked one layer out, by `decodeBoards`
 * (game/serialize.ts): the rules of §2 have one implementation, in the game.
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
export const gameSchema = gameSlotSchema(S6_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(S6_STORAGE_KEYS.dailyGame, 'daily');
