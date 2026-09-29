/**
 * Box Regions' own persisted records, under the `br.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/BOX_REGIONS_RULES.md §11). Where a record holds a map
 * of results, a malformed entry is dropped rather than costing the player the
 * whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DIFFICULTIES,
  MAX_REGIONS,
  MAX_REGION_SIZE,
  MIN_REGION_SIZE,
  PRESETS,
  isDifficulty,
  isShapeKind,
  isValidClueList,
  type Clue,
  type Difficulty,
  type GameMode,
} from '../game';

import { BR_STORAGE_KEYS } from './keys';

export { BR_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

/** The largest board's cell count, plus room for a future one — the cap on a board string. */
const MAX_CELLS = 256;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BR_STORAGE_KEYS.flags,
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
 * The one thing Box Regions remembers across boards: the difficulty last
 * chosen (§11). Not a setting — nothing here changes how a board plays; it
 * only saves choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: BR_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    // A record without the field is older, not corrupt: the home simply
    // leads with the board a fresh install would.
    if (raw.difficulty === undefined) return { schemaVersion: 1, difficulty: 'easy' };
    const difficulty = asDifficulty(raw.difficulty);
    return difficulty === null ? null : { schemaVersion: 1, difficulty };
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
 * Per difficulty, plus the days the daily was cleared (§10). The daily record
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
  key: BR_STORAGE_KEYS.stats,
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
 * One suspended game (§11): the clues, the answer, what the player has
 * drawn, the clock, the seed. Two board strings travel — solution and
 * assignment — and what they hold is checked one layer out, by `decodeBoards`
 * in gamePersistence: the rules of §3 have one implementation, in the game.
 *
 * There is no undo history and no mistake count, on purpose: the history is
 * the largest thing a record could hold and the one thing nobody misses
 * (§6), and this game has no mistake to count (§5).
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  width: number;
  height: number;
  clues: Clue[];
  solution: string;
  assignment: string;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

/** The clue list, structurally (§11): shapes and ranges, then the rules of `isValidClueList`. */
function validateClues(raw: unknown, width: number, height: number): Clue[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_REGIONS) return null;
  const clues: Clue[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) return null;
    const index = asInt(entry.index, 0, width * height - 1);
    const size = entry.size === null ? null : asInt(entry.size, MIN_REGION_SIZE, MAX_REGION_SIZE);
    if (index === null) return null;
    if (size === null && entry.size !== null) return null;
    if (!isShapeKind(entry.kind)) return null;
    clues.push({ index, size, kind: entry.kind });
  }
  return isValidClueList(clues, width, height) ? clues : null;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const width = asInt(raw.width, 1, 16);
  const height = asInt(raw.height, 1, 16);
  const solution = asString(raw.solution, MAX_CELLS);
  const assignment = asString(raw.assignment, MAX_CELLS);
  const hintCount = asInt(raw.hintCount, 0, 1e6);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    width === null ||
    height === null ||
    solution === null ||
    assignment === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'difficulty' && dailyDate !== null) return null;

  // The board must be the shape the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  const preset = PRESETS[difficulty];
  if (width !== preset.width || height !== preset.height) return null;
  const clues = validateClues(raw.clues, width, height);
  if (clues === null) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    width,
    height,
    clues,
    solution,
    assignment,
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
export const gameSchema = gameSlotSchema(BR_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(BR_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
