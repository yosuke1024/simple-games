/**
 * Crown Grid's own persisted records, under the `cg.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/CROWN_GRID_RULES.md §11). Where a record holds a map of
 * results, a malformed entry is dropped rather than costing the player the
 * whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import { cellCount, isDifficulty, isSize, SIZE_FOR, type Difficulty, type GameMode } from '../game';

import { CG_STORAGE_KEYS } from './keys';

export { CG_STORAGE_KEYS };

/** The longest board string any size produces — one character per cell. */
const MAX_BOARD_LENGTH = cellCount(SIZE_FOR.hard);

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: CG_STORAGE_KEYS.flags,
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
 * The one thing Crown Grid remembers across boards: the difficulty last
 * picked (§9). Not a setting — nothing here changes how a board plays; it
 * only saves choosing again, and it is where Quick Rules' "Start Playing"
 * takes a first-time player.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: CG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isDifficulty(raw.difficulty) ? { schemaVersion: 1, difficulty: raw.difficulty } : null;
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
  key: CG_STORAGE_KEYS.stats,
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
 * One suspended game (§11). Three boards travel as strings — the regions, the
 * answer, and what the player marked — plus the counters. There is no
 * mistakeCount, and not because it was forgotten: this game has no mistake to
 * count (§5, §14).
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  size: number;
  regions: string;
  solution: string;
  marks: string;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = isDifficulty(raw.difficulty) ? raw.difficulty : null;
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const size = isSize(raw.size) ? raw.size : null;
  const regions = asString(raw.regions, MAX_BOARD_LENGTH);
  const solution = asString(raw.solution, SIZE_FOR.hard);
  const marks = asString(raw.marks, MAX_BOARD_LENGTH);
  const hintCount = asInt(raw.hintCount, 0, 1e9);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    size === null ||
    regions === null ||
    solution === null ||
    marks === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  // The board must be the size the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  if (size !== SIZE_FOR[difficulty]) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    size,
    regions,
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
 * daily record sitting in the `difficulty` key loads happily, and resuming
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

/** Suspended difficulty game. */
export const gameSchema = gameSlotSchema(CG_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(CG_STORAGE_KEYS.dailyGame, 'daily');
