/**
 * Bridges' own persisted records, under the `bg.` prefix declared in ./keys.
 * Isolated from the shared records and from every other game: corruption here
 * can never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/BRIDGES_RULES.md §10). Where a record holds a map of
 * results, a malformed entry is dropped rather than costing the player the
 * whole history.
 *
 * The saved-game validator checks everything about a record short of the
 * solver's search (§10): types, ranges, the shape the difficulty promises,
 * and then what the strings mean as far as the rules can read it in one
 * pass — a legal board, an answer that wins on it, bridges the board can
 * hold, an island count the tier deals, a game not yet won. That is all
 * bounded by the board (at most 10 × 10 cells), and it is all that Backup &
 * Restore runs on a record (docs/architecture/backup.md): a backup holding an
 * impossible board is refused whole, and an export never carries one.
 *
 * The one check left out is the search: whether the answer is the board's
 * ONLY one (`countSolutions`, §6). It runs one layer out, in `fromRecord`,
 * when the game itself loads a slot — never for a backup, where no board is
 * being opened. A record that fails only that is never resumed, and, like any
 * record a game refuses, is not deleted: it stays on disk until the slot is
 * next written (§10 says what that leaves open).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asDateString, asInt, asString, isRecord } from '../../../storage/validate';
import {
  DAILY_DIFFICULTY,
  DIFFICULTIES,
  PRESETS,
  decodeBoards,
  isDifficulty,
  isSolved,
  type Difficulty,
  type GameMode,
} from '../game';

import { BG_STORAGE_KEYS } from './keys';

export { BG_STORAGE_KEYS };

const asDifficulty = (value: unknown): Difficulty | null => (isDifficulty(value) ? value : null);

/** The ceiling of a record's counters — hints and seconds (§10). */
const MAX_COUNTER = 1e9;

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: BG_STORAGE_KEYS.flags,
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
 * The one thing Bridges remembers across boards: the difficulty last chosen
 * (§8). Not a setting — nothing here changes how a board plays; it only saves
 * choosing again.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: BG_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'easy' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const difficulty = asDifficulty(raw.difficulty);
    return difficulty === null ? null : { schemaVersion: 1, difficulty };
  },
};

// ---------- statistics ----------

/** One difficulty's Free Play record (§11). */
export interface DifficultyStats {
  played: number;
  solved: number;
  totalPlaySeconds: number;
  bestSeconds: number | null;
}

/**
 * The daily's own play record (§11). Its clears are the dates in `dailyTimes`
 * — a set, never a run — so nothing here could count a streak.
 */
export interface DailyStats {
  played: number;
  totalPlaySeconds: number;
}

/**
 * Per difficulty, the daily kept apart from them, and the days the daily was
 * cleared (§11). The total play time on the statistics screen is the sum of
 * the four `totalPlaySeconds`; it is never stored on its own, so it cannot
 * disagree with them.
 */
export interface Stats {
  schemaVersion: 1;
  easy: DifficultyStats;
  medium: DifficultyStats;
  hard: DifficultyStats;
  daily: DailyStats;
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
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const solved = asInt(raw.solved, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  const bestSeconds = raw.bestSeconds === null ? null : asInt(raw.bestSeconds, 0, MAX_COUNTER);
  if (played === null || solved === null || totalPlaySeconds === null) return null;
  if (bestSeconds === null && raw.bestSeconds !== null) return null;
  return { played, solved, totalPlaySeconds, bestSeconds };
};

const validateDailyStats = (raw: unknown): DailyStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, MAX_COUNTER);
  const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
  return played === null || totalPlaySeconds === null ? null : { played, totalPlaySeconds };
};

/** A record big enough for years of dailies, small enough to stay bounded. */
const MAX_DAILY_ENTRIES = 2000;

export const statsSchema: SchemaDef<Stats> = {
  key: BG_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    easy: emptyDifficultyStats(),
    medium: emptyDifficultyStats(),
    hard: emptyDifficultyStats(),
    daily: { played: 0, totalPlaySeconds: 0 },
    dailyTimes: {},
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const easy = validateDifficultyStats(raw.easy);
    const medium = validateDifficultyStats(raw.medium);
    const hard = validateDifficultyStats(raw.hard);
    const daily = validateDailyStats(raw.daily);
    if (easy === null || medium === null || hard === null || daily === null) return null;

    // One unreadable date must not cost the player every other day they
    // cleared, so bad entries are dropped rather than failing the record.
    const dailyTimes: Record<string, number> = {};
    if (isRecord(raw.dailyTimes)) {
      for (const [key, value] of Object.entries(raw.dailyTimes)) {
        const seconds = asInt(value, 0, MAX_COUNTER);
        if (
          asDateString(key) !== null &&
          seconds !== null &&
          Object.keys(dailyTimes).length < MAX_DAILY_ENTRIES
        ) {
          dailyTimes[key] = seconds;
        }
      }
    }

    return { schemaVersion: 1, easy, medium, hard, daily, dailyTimes };
  },
};

// ---------- saved game ----------

/**
 * One suspended game (§10): `game/session.ts`'s `SessionRecord` with the
 * storage layer's version and timestamp around it. The board is one character
 * per cell; the answer and the player's bridges are one digit per edge, in the
 * edge order the board alone fixes (§2).
 *
 * There is no undo history and no mistake count, on purpose: the history is
 * the largest thing a record could hold and the one thing nobody misses (§9),
 * and this game has no mistake to count (§3).
 */
export interface PersistedGame {
  schemaVersion: 1;
  mode: GameMode;
  seed: string;
  difficulty: Difficulty;
  dailyDate: string | null;
  width: number;
  height: number;
  board: string;
  solution: string;
  bridges: string;
  hintCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const BOARD_CHARACTERS = /^[.1-8]+$/;
const EDGE_DIGITS = /^[012]+$/;

const validatePersistedGame = (raw: unknown): PersistedGame | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const mode = raw.mode === 'difficulty' || raw.mode === 'daily' ? raw.mode : null;
  const seed = asString(raw.seed);
  const difficulty = asDifficulty(raw.difficulty);
  const dailyDate = raw.dailyDate === null ? null : asDateString(raw.dailyDate);
  const width = asInt(raw.width, 2, 16);
  const height = asInt(raw.height, 2, 16);
  const hintCount = asInt(raw.hintCount, 0, MAX_COUNTER);
  const elapsedSeconds = asInt(raw.elapsedSeconds, 0, MAX_COUNTER);
  const savedAt = asInt(raw.savedAt, 0, 1e15);

  if (
    mode === null ||
    seed === null ||
    seed.length === 0 ||
    difficulty === null ||
    width === null ||
    height === null ||
    hintCount === null ||
    elapsedSeconds === null ||
    savedAt === null
  ) {
    return null;
  }
  if (dailyDate === null && raw.dailyDate !== null) return null;
  if (mode === 'daily' && dailyDate === null) return null;
  if (mode === 'difficulty' && dailyDate !== null) return null;
  // Every daily is medium (§8); a dated record at another difficulty cannot
  // have come from play, however well-formed its board is (§10).
  if (mode === 'daily' && difficulty !== DAILY_DIFFICULTY) return null;

  // The board must be the shape the difficulty promises; anything else is a
  // record from another world, and decoding it would only fail later.
  const preset = PRESETS[difficulty];
  if (width !== preset.width || height !== preset.height) return null;
  const cells = width * height;
  const board = asString(raw.board, cells);
  if (board === null || board.length !== cells || !BOARD_CHARACTERS.test(board)) return null;
  // At most two edges leave each island (right and down), so twice the cells
  // bounds the digit strings without knowing the board.
  const solution = asString(raw.solution, 2 * cells);
  const bridges = asString(raw.bridges, 2 * cells);
  if (solution === null || bridges === null) return null;
  if (!EDGE_DIGITS.test(solution) || !EDGE_DIGITS.test(bridges)) return null;
  if (solution.length !== bridges.length) return null;

  // What the strings mean, short of the search (§10): the same decoder and
  // win check `fromRecord` uses, so the two layers cannot read a record
  // differently. `fromRecord` asks all of it again, then whether the answer
  // is the board's only one.
  const decoded = decodeBoards({ board, solution, bridges }, width, height);
  if (decoded === null) return null;
  const islands = decoded.layout.islands.length;
  if (islands < preset.minIslands || islands > preset.maxIslands) return null;
  // A won board is history, not a game to resume (§3, §10).
  if (isSolved(decoded.graph, decoded.bridges)) return null;

  return {
    schemaVersion: 1,
    mode,
    seed,
    difficulty,
    dailyDate,
    width,
    height,
    board,
    solution,
    bridges,
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
export const gameSchema = gameSlotSchema(BG_STORAGE_KEYS.game, 'difficulty');
/** Suspended daily game, kept separately so neither mode evicts the other. */
export const dailyGameSchema = gameSlotSchema(BG_STORAGE_KEYS.dailyGame, 'daily');

/** For the statistics screen: the difficulties in table order. */
export { DIFFICULTIES };
