/**
 * Loop Puzzle's own persisted records, under the `lp.` prefix. Isolated from
 * the shared records and from every other game: corruption here can never
 * take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/LOOP_PUZZLE_RULES.md §12). Where a record holds a map
 * of results, a malformed entry is dropped rather than costing the player the
 * whole history.
 *
 * These validators check fields only — shapes, ranges, characters, the size
 * the difficulty promises — and never search. Whether a saved board's clues
 * have exactly one loop is proven one layer out, by `decodeBoard` in
 * gamePersistence, and only when the game actually loads a slot (§12): a
 * backup check or the shell's start-up never runs the counting search.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DAILY_DIFFICULTY,
  DIFFICULTIES,
  ELAPSED_SECONDS_MAX,
  HINT_COUNT_MAX,
  PRESETS,
  gridFor,
  isDifficulty,
  isLocalDateString,
  type Difficulty,
  type GameMode,
} from '../game';

import { LP_STORAGE_KEYS } from './keys';

export { LP_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

/** The longest seed a record may carry: `loop-puzzle-hard-<time>-<random>` is about 35. */
const MAX_SEED_LENGTH = 120;

/** One character per cell: `0`–`3`, or `.` for no number (§12). A `4` is never written. */
const CLUE_STRING = /^[0-3.]+$/;
/** One character per edge: `.` UNKNOWN, `L` LINE, `X` CROSS (§12). */
const MARK_STRING = /^[.LX]+$/;
/** `lp1:` and eight lower-case hex digits (`game/serialize.ts` `cluesDigest`). */
const DIGEST_STRING = /^lp1:[0-9a-f]{8}$/;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: LP_STORAGE_KEYS.flags,
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
 * The one thing Loop Puzzle remembers across boards: the difficulty last
 * chosen (§9, §12). Not a setting — nothing here changes how a board plays;
 * it only saves choosing again, and it is the board the first Quick Rules
 * lead straight into.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: LP_STORAGE_KEYS.prefs,
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
 * The total play time across all boards is the sum of the three
 * `totalPlaySeconds`, shown rather than stored.
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
  key: LP_STORAGE_KEYS.stats,
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
          isLocalDateString(key) &&
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
 * One suspended game (§12): the smallest record that holds it — what decides
 * the board (the clues and their digest) and what the player wrote (the
 * marks), plus the counters. **The answer is not saved**: the loader
 * re-derives it with the counting search, which is also the check that the
 * clues are a board the rules accept (`decodeBoard`, gamePersistence).
 *
 * There is no undo history and no mistake count, on purpose: the history is
 * the largest thing a record could hold and the one thing nobody misses (§6),
 * and this game has no mistake to count (§3). There is no status either: a
 * solved board is never saved, and the win is read again from the marks.
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  width: number;
  height: number;
  /** One character per cell, row-major: `0`–`3`, or `.` for none. */
  clues: string;
  /** `cluesDigest(clues)` as it was when the record was written. */
  cluesDigest: string;
  /** One character per edge in the order of §1: `.` / `L` / `X`. */
  marks: string;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed, MAX_SEED_LENGTH);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = isLocalDateString(raw.dailyDate) ? raw.dailyDate : null;
  const width = asInt(raw.width, 1, 16);
  const height = asInt(raw.height, 1, 16);
  const clues = asString(raw.clues, 256);
  const cluesDigest = asString(raw.cluesDigest, 16);
  const marks = asString(raw.marks, 512);
  const hintCount = asInt(raw.hintCount, 0, HINT_COUNT_MAX);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, ELAPSED_SECONDS_MAX);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    width === null ||
    height === null ||
    clues === null ||
    cluesDigest === null ||
    marks === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  // `dailyDate` is a real calendar day or null — never a malformed string.
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'difficulty' && dailyDate !== null) return null;
  // Every daily is medium (§9); a dated record at another difficulty cannot
  // have come from play, however well-formed its board is (§12).
  if (mode === 'daily' && difficulty !== DAILY_DIFFICULTY) return null;

  // The board must be the shape the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  const preset = PRESETS[difficulty];
  if (width !== preset.width || height !== preset.height) return null;
  if (clues.length !== width * height || !CLUE_STRING.test(clues)) return null;
  if (!DIGEST_STRING.test(cluesDigest)) return null;
  if (marks.length !== gridFor(width, height).edgeCount || !MARK_STRING.test(marks)) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    width,
    height,
    clues,
    cluesDigest,
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
export const gameSchema = gameSlotSchema(LP_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(LP_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
