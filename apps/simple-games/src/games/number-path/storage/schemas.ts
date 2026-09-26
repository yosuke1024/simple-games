/**
 * Number Path's own persisted records, under the `np.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/NUMBER_PATH_RULES.md §9). Where a record holds a map of
 * results, a malformed entry is dropped rather than costing the player the
 * whole history.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DAILY_DIFFICULTY,
  isDifficulty,
  MAX_SIDE,
  TIERS,
  type Difficulty,
  type GameMode,
} from '../game';

import { NP_STORAGE_KEYS } from './keys';

export { NP_STORAGE_KEYS };

/** The most cells any board has — the cap on a path or a solution list. */
const MAX_CELLS = MAX_SIDE * MAX_SIDE;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: NP_STORAGE_KEYS.flags,
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
 * The one thing Number Path remembers across boards: the difficulty last
 * chosen (§9). Not a setting — nothing here changes how a board plays; it
 * only saves choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: NP_STORAGE_KEYS.prefs,
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
 * Per difficulty, plus the days the daily was solved (§8). The daily record
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

export const statsSchema: SchemaDef<Stats> = {
  key: NP_STORAGE_KEYS.stats,
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
 * A suspended game (§9): the board as a size, a sparse number list and a wall
 * list, the one solution, the path drawn so far, the clock and the seed.
 * The undo history is not here — a resumed game starts with an empty stack.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  width: number;
  height: number;
  /** [cell, number] pairs, in number order. */
  numbers: (readonly [number, number])[];
  /** Wall ids: `h<i>` below cell i, `v<i>` right of cell i. */
  walls: string[];
  solution: number[];
  path: number[];
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const asCells = (value: unknown): number[] | null =>
  Array.isArray(value) &&
  value.length <= MAX_CELLS &&
  value.every((cell) => asInt(cell, 0, MAX_CELLS - 1) !== null)
    ? (value as number[])
    : null;

const asNumbers = (value: unknown): (readonly [number, number])[] | null => {
  if (!Array.isArray(value) || value.length > MAX_CELLS) return null;
  const out: (readonly [number, number])[] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const cell = asInt(entry[0], 0, MAX_CELLS - 1);
    const n = asInt(entry[1], 1, MAX_CELLS);
    if (cell === null || n === null) return null;
    out.push([cell, n]);
  }
  return out;
};

const asWalls = (value: unknown): string[] | null =>
  Array.isArray(value) &&
  value.length <= 2 * MAX_CELLS &&
  value.every((id) => typeof id === 'string' && /^[hv]\d{1,2}$/.test(id))
    ? (value as string[])
    : null;

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = isDifficulty(raw.difficulty) ? raw.difficulty : null;
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const width = asInt(raw.width, 2, MAX_SIDE);
  const height = asInt(raw.height, 2, MAX_SIDE);
  const numbers = asNumbers(raw.numbers);
  const walls = asWalls(raw.walls);
  const solution = asCells(raw.solution);
  const path = asCells(raw.path);
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
    numbers === null ||
    walls === null ||
    solution === null ||
    path === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  // A daily is medium every day (§7); a record claiming another difficulty is
  // one play could not have produced, and Retry would silently rebuild it as
  // a different board (§9 fail-closed).
  if (mode === 'daily' && difficulty !== DAILY_DIFFICULTY) return null;

  // The board must be the shape the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  const tier = TIERS[difficulty];
  if (width !== tier.width || height !== tier.height) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    width,
    height,
    numbers,
    walls,
    solution,
    path,
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
 * What the board, the solution and the path hold is checked one layer out,
 * by `decodeGame` in gamePersistence (§9): the rules of §3 have one
 * implementation, in the game, and a second copy here would be a second
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

/** Suspended difficulty game. */
export const gameSchema = gameSlotSchema(NP_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(NP_STORAGE_KEYS.dailyGame, 'daily');
