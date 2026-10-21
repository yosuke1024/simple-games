/**
 * Make the Target's own persisted records, under the `tg.` prefix declared in
 * ./keys (docs/MAKE_THE_TARGET_RULES.md §10). Isolated from the shared records
 * and from every other game: corruption here can never take the shell or
 * another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. Every record is `schemaVersion: 1`; while the game is in
 * early release the shapes may still change, and they freeze when it
 * graduates (§10).
 *
 * A saved game is checked here in full (§10「検証の置き場所」): the shape, the
 * key it sits under, and then the game's own replay (`restoreSession`), which
 * plays the stored solution and the stored moves through the rules — at most
 * n−1 moves each, bounded by the board. Backup & Restore runs this same
 * schema, so a backup can neither carry nor bring in a game the loader would
 * refuse. Nothing here searches (§6): the tier's `ways` band is not checked on
 * load (§10「確かめないこと」).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DIFFICULTIES,
  isDifficulty,
  isLocalDateString,
  restoreSession,
  SAVED_AT_MAX,
  toRecord,
  type Difficulty,
  type GameMode,
  type SessionRecord,
} from '../game';

import { TG_STORAGE_KEYS } from './keys';

export { TG_STORAGE_KEYS };

/**
 * The longest seed a record may carry. A Free Play seed is
 * `make-the-target-<difficulty>-<time>-<random>`, about 40 characters; the
 * daily's is 32. Anything far past that is not a seed this game wrote.
 */
export const MAX_SEED_LENGTH = 120;

/** The largest play count, clear count or clear time a record may hold (§10). */
const MAX_COUNTER = 1e9;
/** The largest total play time a record may hold (§10). */
const MAX_TOTAL_SECONDS = 1e12;
/** A record big enough for years of dailies, small enough to stay bounded (§10). */
export const MAX_DAILY_ENTRIES = 2000;

/**
 * A validator that cannot throw (§10, docs/architecture/backup.md): whatever
 * it is handed — a getter that throws on any field, at any depth — a failure
 * reads as "not a record", null. JSON cannot carry a getter, and the loader
 * catches anyway (src/storage/repo.ts); this makes the promise the schema's
 * own rather than its callers'.
 */
function neverThrowing<T>(validate: (raw: unknown) => T | null): (raw: unknown) => T | null {
  return (raw) => {
    try {
      return validate(raw);
    } catch {
      return null;
    }
  };
}

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: TG_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: neverThrowing((raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  }),
};

// ---------- preferences ----------

/**
 * The one thing remembered across problems: the difficulty last chosen (§8).
 * Not a setting — nothing here changes how a problem plays; it only saves
 * choosing again, and it is the tier the first Quick Rules lead straight into.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: TG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: neverThrowing((raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    // `isDifficulty`, not a lookup: a stored 'toString' names a property every
    // object has, and must read as "not a difficulty", never as one. Read once,
    // so the value checked is the value kept.
    const difficulty = raw.difficulty;
    return isDifficulty(difficulty) ? { schemaVersion: 1, difficulty } : null;
  }),
};

// ---------- statistics ----------

/** One difficulty's Free Play record (§9). */
export interface DifficultyStats {
  /** Problems begun: a new problem or a retry, never a resume. */
  played: number;
  /** Clears. A problem whose solution was shown is not one (§5). */
  solved: number;
  totalPlaySeconds: number;
  /** The fastest clear; null until the first. A retry of a solved problem never moves it (§9). */
  bestSeconds: number | null;
}

/**
 * The daily's own play record (§9). Its clears are the dates in `dailyTimes`
 * — a set, never a run — so nothing here could count a streak.
 */
export interface DailyStats {
  played: number;
  totalPlaySeconds: number;
}

/**
 * Per difficulty, the daily kept apart from them (provisional — §9, §17), and
 * the days the daily was cleared. The total play time on the statistics
 * screen is the sum of the four `totalPlaySeconds`; it is never stored on its
 * own, so it cannot disagree with them.
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  daily: DailyStats;
  /** Sparse map: YYYY-MM-DD → the seconds of that day's first clear. */
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
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const solved = asInt(raw.solved, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, MAX_TOTAL_SECONDS);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, MAX_COUNTER);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds };
};

const validateDailyStats = (raw: unknown): DailyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, MAX_TOTAL_SECONDS);
  return played === null || totalPlaySeconds === null ? null : { played, totalPlaySeconds };
};

export const statsSchema: SchemaDef<Stats> = {
  key: TG_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    daily: { played: 0, totalPlaySeconds: 0 },
    dailyTimes: {},
  }),
  validate: neverThrowing((raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    const daily = validateDailyStats(raw.daily);
    if (easy === null || medium === null || hard === null || daily === null) return null;

    // One unreadable date must not cost the player every other day they
    // cleared, so bad entries are dropped rather than failing the record (§10).
    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      let kept = 0;
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, MAX_COUNTER);
        if (isLocalDateString(key) && seconds !== null && kept < MAX_DAILY_ENTRIES) {
          dailyTimes[key] = seconds;
          kept++;
        }
      }
    }

    return { schemaVersion: 1, easy, medium, hard, daily, dailyTimes };
  }),
};

// ---------- saved game ----------

/**
 * One suspended game (§10): `game/restore.ts`'s `SessionRecord` — the problem
 * as dealt (numbers, target, the solution kept with it) and the moves made,
 * never a board. The move list is also the Undo history, so a resumed game
 * can still be taken back to the numbers as dealt (§5).
 */
export type PersistedGame = SessionRecord;

/**
 * Fail-closed (§10): the shape a slot may hold, then the replay. `savedAt` is
 * read once, up front, and `restoreSession` checks every field again on its
 * own and replays the solution and the moves through the rules — so a record
 * play could not have produced (an illegal move, a solution that is not one,
 * a problem the tier never deals, a finished board, a counter out of range)
 * comes back as null, and the player lands on the game's home with nothing
 * restored. What is returned is the record as the replay rebuilt it, so a
 * stored −0 reads as 0 and an unknown extra field is dropped.
 */
const validatePersistedGame = neverThrowing((raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  if (asString(raw.seed, MAX_SEED_LENGTH) === null) return null;
  const savedAt = asInt(raw.savedAt, 0, SAVED_AT_MAX);
  if (savedAt === null) return null;
  const session = restoreSession(raw);
  return session === null ? null : toRecord(session, savedAt);
});

/**
 * One slot per mode. Both hold the same record shape, so the KEY is what says
 * which mode a record is — and a record that disagrees with its key is
 * corrupt data, not an instruction to switch modes (src/test/savedGameSlots.test.ts).
 *
 * Without the expected mode, a daily record sitting in the Free Play key
 * loads happily, and resuming it switches the app to the daily slot: the
 * player asks for one game and is shown the other one.
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

/** The suspended Free Play game. */
export const gameSchema = gameSlotSchema(TG_STORAGE_KEYS.game, 'free');
/** The suspended daily, kept separately so neither mode evicts the other (§8). */
export const dailyGameSchema = gameSlotSchema(TG_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
